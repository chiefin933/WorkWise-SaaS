import io
import csv
import uuid
import logging
import calendar
import datetime
from decimal import Decimal

from django.conf import settings
from django.core.mail import EmailMessage
from django.db.models import Sum, Count
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import PayrollRun, PayrollItem, PayrollConfig, MpesaTransaction
from .serializers import PayrollRunDetailSerializer, PayrollRunSerializer
from .engine import PayrollEngine
from employees.models import Employee
from attendance.models import Attendance
from leave.models import Leave

from core.permissions import IsHROrAdmin

logger = logging.getLogger(__name__)


class PayrollRunViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollRunSerializer
    permission_classes = [permissions.IsAuthenticated, IsHROrAdmin]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PayrollRunDetailSerializer
        return PayrollRunSerializer

    def get_queryset(self):
        return PayrollRun.objects.filter(tenant=self.request.user.tenant).order_by('-year', '-month')

    def perform_create(self, serializer):
        tenant = self.request.user.tenant
        month  = serializer.validated_data.get('month')
        year   = serializer.validated_data.get('year')
        # Block creating a new run if an active (non-reversed) run already exists
        existing = PayrollRun.objects.filter(
            tenant=tenant, month=month, year=year
        ).exclude(status='reversed').first()
        if existing:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                f"A payroll run for {month}/{year} already exists (status: {existing.status}). "
                f"Reverse it before creating a corrective run."
            )
        serializer.save(tenant=tenant)

    # ── Summary ───────────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def summary(self, request):
        tenant = request.user.tenant
        today = timezone.now().date()
        month = int(request.query_params.get('month', today.month))
        year = int(request.query_params.get('year', today.year))

        run = PayrollRun.objects.filter(tenant=tenant, month=month, year=year).first()
        items = PayrollItem.objects.filter(payroll_run=run) if run else PayrollItem.objects.none()

        total_net = items.aggregate(t=Sum('net_pay'))['t'] or Decimal('0')
        agg = items.aggregate(
            nssf=Sum('nssf'), shif=Sum('shif'), ahl=Sum('ahl'), paye=Sum('paye')
        )
        total_statutory = sum(
            Decimal(str(agg[k] or 0)) for k in ('nssf', 'shif', 'ahl', 'paye')
        )

        prev_month, prev_year = (month - 1, year) if month > 1 else (12, year - 1)
        prev_run = PayrollRun.objects.filter(tenant=tenant, month=prev_month, year=prev_year).first()
        prev_net = Decimal('0')
        if prev_run:
            prev_net = PayrollItem.objects.filter(payroll_run=prev_run).aggregate(t=Sum('net_pay'))['t'] or Decimal('0')

        change_pct = 0
        if prev_net > 0:
            change_pct = round(((total_net - prev_net) / prev_net) * 100, 1)

        return Response({
            'month': month,
            'year': year,
            'total_net': float(total_net),
            'total_statutory': float(total_statutory),
            'employee_count': items.count(),
            'status': run.status if run else None,
            'change_pct': change_pct,
            'has_run': run is not None,
        })

    # ── Process ───────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        payroll_run = self.get_object()

        if payroll_run.status != 'draft':
            return Response({"error": "Only draft payroll runs can be processed"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            config = PayrollConfig.objects.get(tenant=request.user.tenant)
        except PayrollConfig.DoesNotExist:
            return Response({"error": "Payroll configuration missing for this organization"}, status=status.HTTP_400_BAD_REQUEST)

        engine = PayrollEngine(config)
        employees = Employee.objects.filter(tenant=request.user.tenant, status='active')

        payroll_run.items.all().delete()

        month_start_date = datetime.date(payroll_run.year, payroll_run.month, 1)
        last_day_num = calendar.monthrange(payroll_run.year, payroll_run.month)[1]
        month_end_date = datetime.date(payroll_run.year, payroll_run.month, last_day_num)

        processed_items = []
        for emp in employees:
            attendance_qs = Attendance.objects.filter(
                employee=emp,
                date__month=payroll_run.month,
                date__year=payroll_run.year
            )

            aggregates = attendance_qs.aggregate(
                days_worked=Count('id'),
                total_hours=Sum('hours_worked'),
                total_overtime=Sum('overtime_hours')
            )

            leaves = Leave.objects.filter(
                employee=emp,
                leave_type='unpaid',
                status='approved',
                start_date__lte=month_end_date,
                end_date__gte=month_start_date
            )

            unpaid_leave_days = 0
            for lv in leaves:
                overlap_start = max(lv.start_date, month_start_date)
                overlap_end = min(lv.end_date, month_end_date)
                unpaid_leave_days += (overlap_end - overlap_start).days + 1

            attendance_data = {
                'days_worked': aggregates['days_worked'] or 0,
                'hours_worked': float(aggregates['total_hours'] or 0),
                'overtime_hours': float(aggregates['total_overtime'] or 0),
                'unpaid_leave_days': unpaid_leave_days
            }

            calc = engine.calculate_employee_payroll(emp, attendance_data)
            item_fields = {
                k: v for k, v in calc.items()
                if k in ('gross_salary', 'nssf', 'shif', 'ahl', 'paye', 'net_pay')
            }

            item = PayrollItem.objects.create(
                payroll_run=payroll_run,
                employee=emp,
                **item_fields
            )
            processed_items.append(item)

        payroll_run.status = 'processed'
        payroll_run.save()

        return Response({"message": f"Successfully processed payroll for {len(processed_items)} employees"})

    # ── Approve ───────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Advance a processed payroll run to 'approved' status."""
        payroll_run = self.get_object()
        if payroll_run.status != 'processed':
            return Response(
                {"error": "Only processed payroll runs can be approved."},
                status=status.HTTP_400_BAD_REQUEST
            )
        payroll_run.status = 'approved'
        payroll_run.save(update_fields=['status', 'updated_at'])
        logger.info(
            "Payroll run %s approved by user %s",
            payroll_run.id, request.user.email
        )
        return Response({"message": "Payroll run approved successfully.", "status": "approved"})

    # ── Reverse ───────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        """
        Reverse an approved or paid payroll run.

        This creates a fresh draft run for the same period so it can be
        corrected and reprocessed. The original run is marked 'reversed'.
        If a journal entry was auto-posted to the finance books on approval,
        it is automatically reversed as well.
        """
        from django.db import transaction as db_transaction

        payroll_run = self.get_object()

        if payroll_run.status not in ('approved', 'paid'):
            return Response(
                {'error': 'Only approved or paid payroll runs can be reversed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check a reversal doesn't already exist
        if hasattr(payroll_run, 'reversed_by') and payroll_run.reversed_by:
            return Response(
                {'error': 'This payroll run has already been reversed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with db_transaction.atomic():
            # 1. Create a new draft run for the same period
            corrective_run = PayrollRun.objects.create(
                tenant=payroll_run.tenant,
                month=payroll_run.month,
                year=payroll_run.year,
                status='draft',
            )

            # 2. Mark the original run as reversed, linked to the corrective run
            payroll_run.reversed_by = corrective_run
            payroll_run.status = 'reversed'
            payroll_run.save(update_fields=['status', 'reversed_by', 'updated_at'])

            # 3. Reverse the finance books journal entry if one was auto-posted
            try:
                import calendar as _cal
                from finance.books_models import JournalEntry
                ref = f"PR-{payroll_run.year}-{payroll_run.month:02d}"
                je = JournalEntry.objects.filter(
                    tenant=payroll_run.tenant,
                    reference=ref,
                    source='PAYROLL',
                    status='POSTED',
                ).first()
                if je:
                    je.reverse(
                        created_by=request.user,
                        description=(
                            f"Reversal of payroll run "
                            f"{_cal.month_name[payroll_run.month]} {payroll_run.year} "
                            f"— corrective run created"
                        ),
                    )
                    logger.info(
                        "Finance JE %s reversed as part of payroll run %s reversal",
                        je.reference, payroll_run.id,
                    )
            except Exception as exc:
                logger.warning(
                    "Could not reverse finance JE for payroll run %s: %s",
                    payroll_run.id, exc,
                )

        logger.info(
            "Payroll run %s reversed by %s. Corrective run %s created.",
            payroll_run.id, request.user.email, corrective_run.id,
        )

        return Response({
            'message': (
                f"Payroll run for {payroll_run.month}/{payroll_run.year} has been reversed. "
                f"A new draft run has been created — correct and reprocess it."
            ),
            'original_run_id':   str(payroll_run.id),
            'original_status':   'reversed',
            'corrective_run_id': str(corrective_run.id),
            'corrective_status': 'draft',
        })

    # ── Mark Paid ─────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        """Advance an approved payroll run to 'paid' status."""
        payroll_run = self.get_object()
        if payroll_run.status != 'approved':
            return Response(
                {"error": "Only approved payroll runs can be marked as paid."},
                status=status.HTTP_400_BAD_REQUEST
            )
        payroll_run.status = 'paid'
        payroll_run.save(update_fields=['status', 'updated_at'])
        logger.info(
            "Payroll run %s marked paid by user %s",
            payroll_run.id, request.user.email
        )
        return Response({"message": "Payroll run marked as paid.", "status": "paid"})

    # ── M-Pesa Disbursement ───────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='disburse-mpesa')
    def disburse_mpesa(self, request, pk=None):
        """
        Initiate bulk M-Pesa B2C salary disbursement for all mpesa-payment employees
        in this payroll run.

        Simulation mode (MPESA_ENABLED=False, default):
            Creates MpesaTransaction records with mock IDs and immediately marks
            them as 'success'. No real API calls are made.

        Production mode (MPESA_ENABLED=True):
            Calls Safaricom Daraja B2C API. Results arrive asynchronously via
            the /api/mpesa/b2c/result/ and /api/mpesa/b2c/timeout/ webhooks.
        """
        payroll_run = self.get_object()

        if payroll_run.status != 'approved':
            return Response(
                {"error": "Only approved payroll runs can be disbursed via M-Pesa."},
                status=status.HTTP_400_BAD_REQUEST
            )

        mpesa_enabled = getattr(settings, 'MPESA_ENABLED', False)
        items = payroll_run.items.select_related('employee').filter(
            employee__payment_method='mpesa',
            net_pay__gt=0
        )

        if not items.exists():
            return Response(
                {"error": "No M-Pesa payment employees found in this payroll run."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Clear any previous transaction records for this run to allow retry
        payroll_run.mpesa_transactions.all().delete()

        initiated = []
        failed = []

        if mpesa_enabled:
            from .mpesa import DarajaClient
            client = DarajaClient()
            try:
                client.get_access_token()
            except Exception as exc:
                logger.error("Daraja OAuth failed: %s", exc)
                return Response(
                    {"error": f"Could not authenticate with Safaricom Daraja: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY
                )
        else:
            from .mpesa import simulate_b2c_payment

        for item in items:
            emp = item.employee
            phone = emp.mpesa_number or ''
            if not phone:
                failed.append({"employee": emp.name, "reason": "No M-Pesa number on file."})
                continue

            try:
                if mpesa_enabled:
                    result = client.b2c_payment(
                        phone=phone,
                        amount=float(item.net_pay),
                        remarks=f"Salary {payroll_run.month}/{payroll_run.year}"
                    )
                    txn_status = 'pending'
                else:
                    result = simulate_b2c_payment(phone=phone, amount=float(item.net_pay))
                    txn_status = 'success'  # Sim: immediately success

                txn = MpesaTransaction.objects.create(
                    payroll_run=payroll_run,
                    employee=emp,
                    phone_number=phone,
                    amount=item.net_pay,
                    status=txn_status,
                    conversation_id=result.get('ConversationID', ''),
                    originator_conversation_id=result.get('OriginatorConversationID', ''),
                    result_desc="Simulated disbursement." if not mpesa_enabled else "",
                )
                initiated.append({
                    "employee": emp.name,
                    "phone": phone,
                    "amount": float(item.net_pay),
                    "transaction_id": str(txn.id),
                    "status": txn_status,
                })
                logger.info(
                    "M-Pesa B2C %s: employee=%s amount=%.2f sim=%s",
                    txn_status, emp.name, item.net_pay, not mpesa_enabled
                )

            except Exception as exc:
                logger.error("M-Pesa B2C failed for %s: %s", emp.name, exc)
                failed.append({"employee": emp.name, "reason": str(exc)})

        mode = "live" if mpesa_enabled else "simulated"
        return Response({
            "message": f"Initiated {len(initiated)} M-Pesa disbursement(s) ({mode} mode).",
            "mode": mode,
            "initiated": initiated,
            "failed": failed,
            "total_initiated": len(initiated),
            "total_failed": len(failed),
        })

    # ── Bank Export ───────────────────────────────────────────────────────────

    # Plans that include the bank export feature
    GROWTH_PLANS = {'GROWTH', 'BUSINESS', 'ENTERPRISE'}

    @action(detail=True, methods=['get'], url_path='bank-export')
    def bank_export(self, request, pk=None):
        """
        Generate a bank-specific bulk payment CSV for salary disbursement.
        Covers bank-transfer employees only in this payroll run.

        Requires Growth plan or above (GROWTH, BUSINESS, ENTERPRISE).

        Query params:
          ?bank=equity | kcb | coop | stanbic  (default: equity)
        """
        # ── Plan gate ──────────────────────────────────────────────────────────
        tenant = request.user.tenant
        if tenant and tenant.plan not in self.GROWTH_PLANS:
            return Response(
                {
                    "error": (
                        "Bulk Bank Export is available on the Growth plan and above. "
                        "Upgrade to unlock bulk bank payment files for Equity, KCB, "
                        "Co-op, and Stanbic."
                    ),
                    "upgrade_required": True,
                    "current_plan": tenant.plan,
                    "required_plan": "GROWTH",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        payroll_run = self.get_object()
        bank = request.query_params.get('bank', 'equity').lower()

        # Only bank-transfer employees
        items = payroll_run.items.select_related('employee').filter(
            employee__payment_method='bank',
            net_pay__gt=0
        )

        if not items.exists():
            return Response(
                {"error": "No bank-payment employees found in this payroll run."},
                status=status.HTTP_400_BAD_REQUEST
            )

        period = f"{payroll_run.month:02d}_{payroll_run.year}"
        filename = f"bank_export_{bank}_{period}.csv"
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        period_label = f"Salary {payroll_run.month:02d}/{payroll_run.year}"

        BANK_CONFIGS = {
            'equity': {
                'code': '68',
                'headers': ['Bank Code', 'Account Number', 'Account Name',
                            'Amount (KES)', 'Narration', 'Currency'],
            },
            'kcb': {
                'code': '01',
                'headers': ['Reference', 'Bank Code', 'Branch Code',
                            'Account Number', 'Beneficiary Name', 'Amount', 'Narration'],
            },
            'coop': {
                'code': '11',
                'headers': ['Account Number', 'Beneficiary Name', 'Amount (KES)',
                            'Bank Code', 'Branch Code', 'Payment Reference'],
            },
            'stanbic': {
                'code': '31',
                'headers': ['Beneficiary Account', 'Beneficiary Name',
                            'Payment Amount', 'Currency', 'Bank Code', 'Narration'],
            },
        }

        if bank not in BANK_CONFIGS:
            bank = 'equity'
        cfg = BANK_CONFIGS[bank]
        writer.writerow(cfg['headers'])

        for i, item in enumerate(items, start=1):
            emp = item.employee
            bank_info = emp.bank_details or {}
            acct   = bank_info.get('account_number', 'N/A')
            branch = bank_info.get('branch_code', '000')
            amount = f"{float(item.net_pay):.2f}"

            if bank == 'equity':
                writer.writerow([cfg['code'], acct, emp.name, amount, period_label, 'KES'])
            elif bank == 'kcb':
                writer.writerow([f"WW{i:04d}", cfg['code'], branch, acct,
                                 emp.name, amount, period_label])
            elif bank == 'coop':
                writer.writerow([acct, emp.name, amount, cfg['code'],
                                 branch, f"WW-{period}-{i:03d}"])
            elif bank == 'stanbic':
                writer.writerow([acct, emp.name, amount, 'KES', cfg['code'], period_label])

        logger.info(
            "Bank export (%s) generated for payroll run %s by user %s",
            bank, payroll_run.id, request.user.email
        )
        return response

    @action(detail=True, methods=['get'], url_path='mpesa-transactions')
    def mpesa_transactions(self, request, pk=None):
        """Return all M-Pesa transactions for this payroll run."""
        payroll_run = self.get_object()
        txns = payroll_run.mpesa_transactions.select_related('employee').order_by('created_at')
        data = [
            {
                "id": str(t.id),
                "employee_name": t.employee.name,
                "phone_number": t.phone_number,
                "amount": float(t.amount),
                "status": t.status,
                "conversation_id": t.conversation_id,
                "result_desc": t.result_desc,
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat(),
            }
            for t in txns
        ]
        summary = {
            "total": len(data),
            "pending": sum(1 for t in data if t["status"] == "pending"),
            "success": sum(1 for t in data if t["status"] == "success"),
            "failed": sum(1 for t in data if t["status"] == "failed"),
            "total_disbursed": sum(t["amount"] for t in data if t["status"] == "success"),
        }
        mpesa_enabled = getattr(settings, 'MPESA_ENABLED', False)
        mode = "live" if mpesa_enabled else "simulated"
        return Response({"transactions": data, "summary": summary, "mode": mode})

    # ── Send Payslips ─────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='send-payslips')
    def send_payslips(self, request, pk=None):
        """
        Generate a branded PDF payslip per employee and email it to them.
        Works for processed, approved, or paid runs.
        Uses Django's email framework — console backend in dev, SMTP in production.
        """
        payroll_run = self.get_object()

        if payroll_run.status == 'draft':
            return Response(
                {"error": "Process the payroll run before sending payslips."},
                status=status.HTTP_400_BAD_REQUEST
            )

        items = payroll_run.items.select_related('employee').all()
        if not items.exists():
            return Response(
                {"error": "No payroll items found for this run."},
                status=status.HTTP_400_BAD_REQUEST
            )

        tenant = request.user.tenant
        sent_count = 0
        failed = []

        for item in items:
            emp = item.employee
            if not emp.email:
                failed.append({"employee": emp.name, "reason": "No email address on file."})
                continue

            try:
                pdf_buffer = self._generate_payslip_pdf(item, tenant)
                month_name = datetime.date(payroll_run.year, payroll_run.month, 1).strftime('%B %Y')

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
                    'application/pdf'
                )
                email.send(fail_silently=False)
                sent_count += 1
                logger.info("Payslip emailed to %s for run %s", emp.email, payroll_run.id)

            except Exception as exc:
                logger.error("Failed to send payslip to %s: %s", emp.email, exc)
                failed.append({"employee": emp.name, "reason": str(exc)})

        return Response({
            "message": f"Payslips dispatched to {sent_count} employee(s).",
            "sent": sent_count,
            "failed": failed,
        })

    # ── Internal: PDF Generator ───────────────────────────────────────────────

    def _generate_payslip_pdf(self, payroll_item, tenant) -> io.BytesIO:
        """Reusable in-memory PDF payslip generator (mirrors DownloadPayslipView)."""
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=letter,
            rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36
        )

        story = []
        styles = getSampleStyleSheet()

        primary_color = colors.HexColor('#0d9488')
        dark_color    = colors.HexColor('#1e293b')
        light_bg      = colors.HexColor('#f8fafc')
        border_color  = colors.HexColor('#cbd5e1')
        text_dark     = colors.HexColor('#0f172a')
        text_muted    = colors.HexColor('#64748b')

        title_style = ParagraphStyle(
            'Title', parent=styles['Heading1'],
            fontName='Helvetica-Bold', fontSize=20,
            textColor=primary_color, spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            'Subtitle', parent=styles['Normal'],
            fontName='Helvetica', fontSize=10,
            textColor=text_muted, spaceAfter=15
        )
        header_style = ParagraphStyle(
            'SectionHdr', fontName='Helvetica-Bold', fontSize=11,
            textColor=dark_color, spaceAfter=6
        )
        label_style = ParagraphStyle(
            'Label', fontName='Helvetica-Bold', fontSize=9,
            textColor=colors.HexColor('#475569')
        )
        value_style = ParagraphStyle(
            'Value', fontName='Helvetica', fontSize=9, textColor=text_dark
        )
        label_white = ParagraphStyle(
            'LabelWhite', fontName='Helvetica-Bold', fontSize=11, textColor=colors.white
        )
        value_white = ParagraphStyle(
            'ValueWhite', fontName='Helvetica-Bold', fontSize=12, textColor=colors.white
        )
        footer_style = ParagraphStyle(
            'Footer', parent=styles['Normal'],
            fontName='Helvetica-Oblique', fontSize=8,
            textColor=text_muted, alignment=1
        )

        emp = payroll_item.employee
        run = payroll_item.payroll_run

        story.append(Paragraph("WORKWISE HR & PAYROLL SYSTEMS", title_style))
        story.append(Paragraph(
            f"OFFICIAL PAY COMPLIANCE STATEMENT — {run.month}/{run.year}", subtitle_style
        ))

        details_data = [
            [Paragraph("Employee Name:", label_style), Paragraph(emp.name, value_style),
             Paragraph("Organization:", label_style), Paragraph(tenant.name, value_style)],
            [Paragraph("Employment Type:", label_style), Paragraph(emp.get_employment_type_display(), value_style),
             Paragraph("KRA PIN:", label_style), Paragraph(emp.kra_pin or 'N/A', value_style)],
            [Paragraph("Bank Name:", label_style), Paragraph((emp.bank_details or {}).get('bank_name', 'N/A'), value_style),
             Paragraph("Account No:", label_style), Paragraph((emp.bank_details or {}).get('account_number', 'N/A'), value_style)],
            [Paragraph("Date Generated:", label_style), Paragraph(timezone.now().strftime('%Y-%m-%d'), value_style),
             Paragraph("Payment Method:", label_style), Paragraph(emp.get_payment_method_display(), value_style)],
        ]
        details_table = Table(details_data, colWidths=[110, 160, 100, 170])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), light_bg),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 0.5, border_color),
            ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(details_table)
        story.append(Spacer(1, 15))

        story.append(Paragraph("1. COMPENSATIONS & EARNINGS", header_style))
        base_salary = emp.salary_basic
        allowances = emp.allowances or {}
        allowances_total = sum(Decimal(str(v)) for v in allowances.values()) if allowances else Decimal('0.00')

        earnings_data = [
            [Paragraph("<b>Earnings Description</b>", label_style), Paragraph("<b>Amount (KES)</b>", label_style)],
            [Paragraph("Basic Contracted Salary", value_style), Paragraph(f"{base_salary:,.2f}", value_style)],
        ]
        for k, v in allowances.items():
            earnings_data.append([Paragraph(f"Allowance: {k}", value_style), Paragraph(f"{float(v):,.2f}", value_style)])

        diff = payroll_item.gross_salary - base_salary - allowances_total
        if diff > 0:
            earnings_data.append([Paragraph("Overtime & Adjustments", value_style), Paragraph(f"{diff:,.2f}", value_style)])
        elif diff < 0:
            earnings_data.append([Paragraph("Unpaid Leave Deductions", value_style), Paragraph(f"{abs(diff):,.2f}", value_style)])

        earnings_data.append([
            Paragraph("<b>Total Gross Earnings (A)</b>", label_style),
            Paragraph(f"<b>{payroll_item.gross_salary:,.2f}</b>", label_style)
        ])

        earnings_table = Table(earnings_data, colWidths=[380, 160])
        earnings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('BOX', (0, 0), (-1, -1), 0.5, border_color),
            ('LINEBELOW', (0, -1), (-1, -1), 1, primary_color),
            ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(earnings_table)
        story.append(Spacer(1, 12))

        story.append(Paragraph("2. MANDATORY STATUTORY DEDUCTIONS", header_style))
        total_deductions = payroll_item.nssf + payroll_item.shif + payroll_item.ahl + payroll_item.paye
        deductions_data = [
            [Paragraph("<b>Deductions Description</b>", label_style), Paragraph("<b>Amount (KES)</b>", label_style)],
            [Paragraph("National Social Security Fund (NSSF)", value_style), Paragraph(f"{payroll_item.nssf:,.2f}", value_style)],
            [Paragraph("Social Health Insurance Fund (SHIF)", value_style), Paragraph(f"{payroll_item.shif:,.2f}", value_style)],
            [Paragraph("Affordable Housing Levy (AHL)", value_style), Paragraph(f"{payroll_item.ahl:,.2f}", value_style)],
            [Paragraph("KRA Pay As You Earn (PAYE)", value_style), Paragraph(f"{payroll_item.paye:,.2f}", value_style)],
            [Paragraph("<b>Total Deductions (B)</b>", label_style), Paragraph(f"<b>{total_deductions:,.2f}</b>", label_style)],
        ]
        deductions_table = Table(deductions_data, colWidths=[380, 160])
        deductions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('BOX', (0, 0), (-1, -1), 0.5, border_color),
            ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#ef4444')),
            ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(deductions_table)
        story.append(Spacer(1, 15))

        net_data = [[
            Paragraph("NET TAKE HOME SALARY (A - B):", label_white),
            Paragraph(f"KES {payroll_item.net_pay:,.2f}", value_white)
        ]]
        net_table = Table(net_data, colWidths=[340, 200])
        net_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), primary_color),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 12),
            ('BOX', (0, 0), (-1, -1), 1, primary_color),
        ]))
        story.append(net_table)
        story.append(Spacer(1, 25))

        story.append(Paragraph(
            "This pay slip represents an official legal compensation breakdown generated and certified by WorkWise compliance systems.",
            footer_style
        ))
        story.append(Paragraph(
            "Strictly Confidential: Do not disclose this document to third parties without authorization.",
            footer_style
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer


# ── Statutory Export View ─────────────────────────────────────────────────────

from django.shortcuts import get_object_or_404
from rest_framework.views import APIView

from .export_services import StatutoryExporter

STATUTORY_PLANS = {'GROWTH', 'BUSINESS', 'ENTERPRISE'}
VALID_EXPORT_TYPES = {'paye', 'nssf', 'shif', 'ahl'}


class StatutoryExportView(APIView):
    """
    Stream a government-filing CSV for a processed/approved/paid payroll run.

    GET /api/payroll/{payroll_run_id}/export/{export_type}/

    export_type: paye | nssf | shif | ahl

    Requires Growth plan or above (GROWTH, BUSINESS, ENTERPRISE).
    Tenant isolation is enforced via the get_object_or_404 query.
    """

    permission_classes = [permissions.IsAuthenticated, IsHROrAdmin]

    def get(self, request, payroll_run_id, export_type):
        # ── Plan gate ──────────────────────────────────────────────────────────
        tenant = request.user.tenant
        if tenant.plan not in STATUTORY_PLANS:
            return Response(
                {"error": "Upgrade your plan to access statutory exports."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Export-type validation ─────────────────────────────────────────────
        if export_type not in VALID_EXPORT_TYPES:
            return Response(
                {"error": f"Invalid export type '{export_type}'. Must be one of: {', '.join(sorted(VALID_EXPORT_TYPES))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Tenant-scoped run lookup ───────────────────────────────────────────
        payroll_run = get_object_or_404(PayrollRun, id=payroll_run_id, tenant=tenant)

        exporter = StatutoryExporter()
        return getattr(exporter, f'export_{export_type}')(payroll_run)
