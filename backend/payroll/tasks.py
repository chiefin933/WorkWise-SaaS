"""
payroll/tasks.py
----------------
Celery async task definitions for payroll processing and payslip dispatch.

In development (REDIS_URL not set), tasks run synchronously because
CELERY_TASK_ALWAYS_EAGER=True in settings.py, so no Celery worker is needed.

In production, tasks are queued to Redis and executed by a Celery worker.
"""

import logging
import datetime
import calendar
from decimal import Decimal

from celery import shared_task
from django.db.models import Sum, Count

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 10},
    acks_late=True,
    name='payroll.tasks.process_payroll_run',
)
def process_payroll_run(self, payroll_run_id: str, tenant_id: str):
    """
    Asynchronously process a payroll run.

    Iterates over all active employees in the tenant, calculates statutory
    deductions via PayrollEngine, and persists PayrollItem records.

    Arguments:
        payroll_run_id: UUID string of the PayrollRun to process.
        tenant_id: UUID string of the owning Tenant (for scoping).

    Returns:
        dict with processed employee count and any failures.
    """
    import uuid
    from payroll.models import PayrollRun, PayrollItem, PayrollConfig
    from payroll.engine import PayrollEngine
    from employees.models import Employee
    from attendance.models import Attendance
    from leave.models import Leave

    try:
        payroll_run = PayrollRun.objects.get(id=uuid.UUID(payroll_run_id))
    except PayrollRun.DoesNotExist:
        logger.error("PayrollRun %s not found.", payroll_run_id)
        raise

    if payroll_run.status != 'draft':
        logger.warning(
            "PayrollRun %s is not in draft status (current: %s). Skipping.",
            payroll_run_id, payroll_run.status
        )
        return {'skipped': True, 'reason': 'Not in draft status'}

    try:
        config = PayrollConfig.objects.get(tenant_id=uuid.UUID(tenant_id))
    except PayrollConfig.DoesNotExist:
        logger.error("PayrollConfig missing for tenant %s", tenant_id)
        raise ValueError(f"Payroll configuration missing for tenant {tenant_id}")

    engine = PayrollEngine(config)
    employees = Employee.objects.filter(
        tenant_id=uuid.UUID(tenant_id), status='active'
    )

    # Clear any previously generated items to allow safe re-runs
    payroll_run.items.all().delete()

    month_start = datetime.date(payroll_run.year, payroll_run.month, 1)
    last_day = calendar.monthrange(payroll_run.year, payroll_run.month)[1]
    month_end = datetime.date(payroll_run.year, payroll_run.month, last_day)

    processed_count = 0
    failures = []

    for emp in employees:
        try:
            attendance_qs = Attendance.objects.filter(
                employee=emp,
                date__month=payroll_run.month,
                date__year=payroll_run.year,
            )
            agg = attendance_qs.aggregate(
                days_worked=Count('id'),
                total_hours=Sum('hours_worked'),
                total_overtime=Sum('overtime_hours'),
            )

            from django.db import models as _dj_models
            # Split overtime: public holiday/Sunday (2x) vs weekday (1.5x)
            ph_overtime_hours = float(
                attendance_qs.filter(
                    _dj_models.Q(is_public_holiday=True) | _dj_models.Q(is_sunday=True)
                ).aggregate(t=Sum('overtime_hours'))['t'] or 0
            )
            weekday_overtime_hours = max(0, float(agg['total_overtime'] or 0) - ph_overtime_hours)

            # Calculate unpaid leave overlap within the payroll month
            leaves = Leave.objects.filter(
                employee=emp,
                leave_type='unpaid',
                status='approved',
                start_date__lte=month_end,
                end_date__gte=month_start,
            )
            unpaid_leave_days = 0
            for lv in leaves:
                overlap_start = max(lv.start_date, month_start)
                overlap_end = min(lv.end_date, month_end)
                unpaid_leave_days += (overlap_end - overlap_start).days + 1

            attendance_data = {
                'days_worked':                    agg['days_worked'] or 0,
                'hours_worked':                   float(agg['total_hours'] or 0),
                'overtime_hours':                 weekday_overtime_hours,
                'public_holiday_overtime_hours':  ph_overtime_hours,
                'unpaid_leave_days':              unpaid_leave_days,
            }

            calc = engine.calculate_employee_payroll(emp, attendance_data)
            item_fields = {
                k: v for k, v in calc.items()
                if k in ('gross_salary', 'nssf', 'shif', 'ahl', 'paye', 'net_pay')
            }

            PayrollItem.objects.create(
                payroll_run=payroll_run,
                employee=emp,
                **item_fields,
            )
            processed_count += 1

        except Exception as exc:
            logger.error(
                "Failed to process employee %s (%s): %s",
                emp.name, emp.id, exc
            )
            failures.append({'employee_id': str(emp.id), 'error': str(exc)})

    # Update run status regardless of partial failures
    payroll_run.status = 'processed'
    payroll_run.save(update_fields=['status', 'updated_at'])

    logger.info(
        "Payroll run %s processed: %d employees, %d failures.",
        payroll_run_id, processed_count, len(failures)
    )
    return {
        'payroll_run_id': payroll_run_id,
        'processed': processed_count,
        'failures': failures,
    }


def _upload_payslip_to_s3(pdf_buffer, tenant_id: str, year: int, month: int, employee_id: str) -> str | None:
    """
    Upload a payslip PDF to S3 and return the object key.

    Returns None (without raising) if S3 is not configured so the caller can
    gracefully fall back to email-only mode.

    Object key format: payslips/{tenant_id}/{year}/{month}/{employee_id}.pdf
    """
    from django.conf import settings as _settings
    bucket = getattr(_settings, 'AWS_PAYSLIPS_BUCKET', '') or getattr(_settings, 'AWS_STORAGE_BUCKET_NAME', '')
    if not bucket:
        return None

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError

        s3 = boto3.client(
            's3',
            region_name=getattr(_settings, 'AWS_S3_REGION_NAME', None),
            aws_access_key_id=getattr(_settings, 'AWS_ACCESS_KEY_ID', None),
            aws_secret_access_key=getattr(_settings, 'AWS_SECRET_ACCESS_KEY', None),
        )
        key = f"payslips/{tenant_id}/{year}/{month:02d}/{employee_id}.pdf"
        pdf_buffer.seek(0)
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=pdf_buffer.read(),
            ContentType='application/pdf',
            # Private — only accessible via pre-signed URLs
            ACL='private',
            ServerSideEncryption='AES256',
            Metadata={
                'tenant-id': tenant_id,
                'employee-id': employee_id,
                'year': str(year),
                'month': str(month),
            },
        )
        logger.info("Payslip uploaded to s3://%s/%s", bucket, key)
        return key
    except (ImportError, BotoCoreError, ClientError, Exception) as exc:
        logger.warning("S3 upload failed (will continue with email-only): %s", exc)
        return None


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 30},
    acks_late=True,
    name='payroll.tasks.send_payslips_async',
)
def send_payslips_async(self, payroll_run_id: str, tenant_id: str):
    """
    Asynchronously generate, store, and email PDF payslips for every employee
    in a payroll run.

    Workflow per employee:
      1. Generate PDF in-memory.
      2. Upload to S3 (payslips/{tenant_id}/{year}/{month}/{employee_id}.pdf)
         and persist the S3 key on PayrollItem.payslip_s3_key.
         If S3 is not configured, this step is skipped silently.
      3. Email the PDF as an attachment — even when S3 upload succeeded,
         so employees receive their payslip immediately without needing to
         log in.

    Arguments:
        payroll_run_id: UUID string of the PayrollRun.
        tenant_id: UUID string of the Tenant.
    """
    import uuid
    import io
    from django.core.mail import EmailMessage
    from payroll.models import PayrollRun
    from tenants.models import Tenant

    try:
        payroll_run = PayrollRun.objects.get(id=uuid.UUID(payroll_run_id))
        tenant = Tenant.objects.get(id=uuid.UUID(tenant_id))
    except (PayrollRun.DoesNotExist, Tenant.DoesNotExist) as exc:
        logger.error("Object lookup failed in send_payslips_async: %s", exc)
        raise

    items = payroll_run.items.select_related('employee').all()
    sent_count = 0
    uploaded_count = 0
    failures = []

    for item in items:
        emp = item.employee

        try:
            from payroll.views import PayrollRunViewSet
            pdf_buffer = PayrollRunViewSet()._generate_payslip_pdf(item, tenant)
            month_name = datetime.date(payroll_run.year, payroll_run.month, 1).strftime('%B %Y')

            # ── Step 1: Upload to S3 ──────────────────────────────────────────
            s3_key = _upload_payslip_to_s3(
                pdf_buffer,
                tenant_id=str(tenant.id),
                year=payroll_run.year,
                month=payroll_run.month,
                employee_id=str(emp.id),
            )
            if s3_key:
                item.payslip_s3_key = s3_key
                item.save(update_fields=['payslip_s3_key', 'updated_at'])
                uploaded_count += 1

            # ── Step 2: Email (always — employees shouldn't have to log in) ──
            if not emp.email:
                failures.append({'employee': emp.name, 'reason': 'No email address on file.'})
                continue

            pdf_buffer.seek(0)
            email = EmailMessage(
                subject=f"Your {month_name} Payslip — {tenant.name}",
                body=(
                    f"Dear {emp.name},\n\n"
                    f"Please find attached your official payslip for {month_name}.\n\n"
                    f"Summary:\n"
                    f"  Gross Pay:    KES {item.gross_salary:,.2f}\n"
                    f"  PAYE:         KES {item.paye:,.2f}\n"
                    f"  NSSF:         KES {item.nssf:,.2f}\n"
                    f"  SHIF:         KES {item.shif:,.2f}\n"
                    f"  Housing Levy: KES {item.ahl:,.2f}\n"
                    f"  Net Pay:      KES {item.net_pay:,.2f}\n\n"
                    f"This is a system-generated document. Please do not reply to this email.\n\n"
                    f"Regards,\n{tenant.name} HR Team\nPowered by WorkWise"
                ),
                to=[emp.email],
            )
            safe_name = emp.name.replace(' ', '_').lower()
            email.attach(
                f"payslip_{safe_name}_{payroll_run.month}_{payroll_run.year}.pdf",
                pdf_buffer.getvalue(),
                'application/pdf',
            )
            email.send(fail_silently=False)
            sent_count += 1
            logger.info("Payslip emailed to %s (run %s)", emp.email, payroll_run_id)

        except Exception as exc:
            logger.error("Failed to process payslip for %s: %s", emp.name, exc)
            failures.append({'employee': emp.name, 'reason': str(exc)})

    logger.info(
        "send_payslips_async complete: %d emailed, %d uploaded to S3, %d failed (run %s)",
        sent_count, uploaded_count, len(failures), payroll_run_id,
    )
    return {'sent': sent_count, 'uploaded': uploaded_count, 'failures': failures}
