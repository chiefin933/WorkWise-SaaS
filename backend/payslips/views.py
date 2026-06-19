import io
import logging
from django.http import FileResponse
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils import timezone

from payroll.models import PayrollItem
from core.tenant_utils import tenant_required

logger = logging.getLogger(__name__)

# Pre-signed URL expiry: 5 minutes — short enough to prevent link-sharing abuse.
PRESIGNED_URL_EXPIRY_SECONDS = 300


def _generate_presigned_url(s3_key: str) -> str | None:
    """
    Generate a short-lived S3 pre-signed GET URL for the given object key.

    Returns None if S3 is not configured or boto3 is unavailable, so the
    caller can fall through to on-the-fly PDF generation.
    """
    from django.conf import settings as _settings
    bucket = (
        getattr(_settings, 'AWS_PAYSLIPS_BUCKET', '')
        or getattr(_settings, 'AWS_STORAGE_BUCKET_NAME', '')
    )
    if not bucket or not s3_key:
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
        url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket,
                'Key': s3_key,
                'ResponseContentDisposition': (
                    f'attachment; filename="{s3_key.split("/")[-1]}"'
                ),
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY_SECONDS,
        )
        return url
    except (ImportError, BotoCoreError, ClientError, Exception) as exc:
        logger.warning("Could not generate pre-signed URL for key '%s': %s", s3_key, exc)
        return None


class DownloadPayslipView(APIView):
    """
    GET /api/payslips/{pk}/download/

    Secure payslip download with two code paths:

    Path A — S3 stored (preferred):
        If PayrollItem.payslip_s3_key is set and S3 is configured, generate a
        5-minute pre-signed GET URL and redirect the client to it.  The PDF
        is served directly from S3 — the Django server never streams the file.

    Path B — On-the-fly generation (fallback):
        If no S3 key exists (e.g. pre-S3 payroll run, or S3 not configured),
        generate the PDF in-memory using ReportLab and stream it as a response.

    Both paths enforce tenant isolation and employee self-access control.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        tenant, err = tenant_required(request)
        if err:
            return err

        try:
            payroll_item = PayrollItem.objects.select_related(
                'employee', 'payroll_run'
            ).get(id=pk, payroll_run__tenant=tenant)
        except PayrollItem.DoesNotExist:
            logger.warning(
                "Payslip access denied or not found: pk=%s user=%s",
                pk, request.user.email,
            )
            return Response(
                {"error": "Payroll record not found or access denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Employee self-access check
        if (
            request.user.role not in ('ADMIN', 'HR')
            and payroll_item.employee.email != request.user.email
        ):
            logger.warning(
                "Payslip access denied: %s attempted to fetch payslip for %s",
                request.user.email, payroll_item.employee.email,
            )
            return Response(
                {"error": "You do not have permission to access this payslip."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Path A: S3 pre-signed URL ─────────────────────────────────────────
        if payroll_item.payslip_s3_key:
            presigned_url = _generate_presigned_url(payroll_item.payslip_s3_key)
            if presigned_url:
                logger.info(
                    "Serving payslip via S3 pre-signed URL: pk=%s key=%s",
                    pk, payroll_item.payslip_s3_key,
                )
                return redirect(presigned_url)
            # S3 URL generation failed — fall through to on-the-fly generation
            logger.warning(
                "S3 pre-signed URL failed for key '%s'; falling back to on-the-fly PDF.",
                payroll_item.payslip_s3_key,
            )

        # ── Path B: On-the-fly PDF generation ────────────────────────────────
        logger.info("Generating payslip PDF on-the-fly: pk=%s", pk)
        buffer = self._generate_pdf(payroll_item, tenant)
        emp = payroll_item.employee
        safe_name = emp.name.replace(' ', '_').lower()
        response = FileResponse(
            buffer,
            as_attachment=True,
            filename=(
                f"payslip_{safe_name}"
                f"_{payroll_item.payroll_run.month}"
                f"_{payroll_item.payroll_run.year}.pdf"
            ),
        )
        response['Content-Type'] = 'application/pdf'
        return response

    # ── PDF generation (identical to original, extracted to a method) ─────────

    def _generate_pdf(self, payroll_item, tenant) -> io.BytesIO:
        """Generate a branded payslip PDF and return a seeked BytesIO buffer."""
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from decimal import Decimal

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=letter,
            rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        primary_color = colors.HexColor('#0d9488')
        dark_color    = colors.HexColor('#1e293b')
        light_bg      = colors.HexColor('#f8fafc')
        border_color  = colors.HexColor('#cbd5e1')
        text_dark     = colors.HexColor('#0f172a')
        text_muted    = colors.HexColor('#64748b')

        title_style = ParagraphStyle(
            'PayslipTitle', parent=styles['Heading1'],
            fontName='Helvetica-Bold', fontSize=20,
            textColor=primary_color, spaceAfter=4,
        )
        subtitle_style = ParagraphStyle(
            'PayslipSubtitle', parent=styles['Normal'],
            fontName='Helvetica', fontSize=10,
            textColor=text_muted, spaceAfter=15,
        )
        header_style = ParagraphStyle(
            'SectionHeader', fontName='Helvetica-Bold', fontSize=11,
            textColor=dark_color, spaceAfter=6,
        )
        label_style = ParagraphStyle(
            'FieldLabel', fontName='Helvetica-Bold', fontSize=9,
            textColor=colors.HexColor('#475569'),
        )
        value_style = ParagraphStyle(
            'FieldValue', fontName='Helvetica', fontSize=9, textColor=text_dark,
        )
        value_white_style = ParagraphStyle(
            'FieldValueWhite', fontName='Helvetica-Bold', fontSize=12,
            textColor=colors.white,
        )
        label_white_style = ParagraphStyle(
            'FieldLabelWhite', fontName='Helvetica-Bold', fontSize=11,
            textColor=colors.white,
        )

        emp = payroll_item.employee
        story = []

        story.append(Paragraph("WORKWISE HR & PAYROLL SYSTEMS", title_style))
        story.append(Paragraph(
            f"OFFICIAL PAY COMPLIANCE STATEMENT - "
            f"{payroll_item.payroll_run.month}/{payroll_item.payroll_run.year}",
            subtitle_style,
        ))

        details_data = [
            [
                Paragraph("Employee Name:", label_style), Paragraph(emp.name, value_style),
                Paragraph("Organization:", label_style), Paragraph(tenant.name, value_style),
            ],
            [
                Paragraph("Employment Type:", label_style),
                Paragraph(emp.get_employment_type_display(), value_style),
                Paragraph("KRA PIN:", label_style),
                Paragraph(emp.kra_pin or 'N/A', value_style),
            ],
            [
                Paragraph("Bank Name:", label_style),
                Paragraph((emp.bank_details or {}).get('bank_name', 'N/A'), value_style),
                Paragraph("Account Number:", label_style),
                Paragraph((emp.bank_details or {}).get('account_number', 'N/A'), value_style),
            ],
            [
                Paragraph("Date Generated:", label_style),
                Paragraph(timezone.now().strftime('%Y-%m-%d'), value_style),
                Paragraph("Payment Method:", label_style),
                Paragraph(emp.get_payment_method_display(), value_style),
            ],
        ]
        details_table = Table(details_data, colWidths=[110, 160, 100, 170])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), light_bg),
            ('ALIGN',      (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING',    (0, 0), (-1, -1), 8),
            ('BOX',        (0, 0), (-1, -1), 0.5, border_color),
            ('INNERGRID',  (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(details_table)
        story.append(Spacer(1, 15))

        story.append(Paragraph("1. COMPENSATIONS & EARNINGS", header_style))
        base_salary = emp.salary_basic
        allowances = emp.allowances or {}
        allowances_total = (
            sum(Decimal(str(v)) for v in allowances.values())
            if allowances else Decimal('0.00')
        )
        earnings_data = [
            [Paragraph("<b>Earnings Description</b>", label_style),
             Paragraph("<b>Amount (KES)</b>", label_style)],
            [Paragraph("Basic Contracted Salary", value_style),
             Paragraph(f"{base_salary:,.2f}", value_style)],
        ]
        for k, v in allowances.items():
            earnings_data.append([
                Paragraph(f"Allowance: {k}", value_style),
                Paragraph(f"{float(v):,.2f}", value_style),
            ])
        diff = payroll_item.gross_salary - base_salary - allowances_total
        if diff > 0:
            earnings_data.append([
                Paragraph("Overtime & Punctuality Adjustments", value_style),
                Paragraph(f"{diff:,.2f}", value_style),
            ])
        elif diff < 0:
            earnings_data.append([
                Paragraph("Unpaid Leave Deductions", value_style),
                Paragraph(f"{abs(diff):,.2f}", value_style),
            ])
        earnings_data.append([
            Paragraph("<b>Total Gross Earnings (A)</b>", label_style),
            Paragraph(f"<b>{payroll_item.gross_salary:,.2f}</b>", label_style),
        ])
        earnings_table = Table(earnings_data, colWidths=[380, 160])
        earnings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('ALIGN',      (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING',    (0, 0), (-1, -1), 6),
            ('BOX',        (0, 0), (-1, -1), 0.5, border_color),
            ('LINEBELOW',  (0, -1), (-1, -1), 1, primary_color),
            ('INNERGRID',  (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(earnings_table)
        story.append(Spacer(1, 12))

        story.append(Paragraph("2. MANDATORY STATUTORY DEDUCTIONS", header_style))
        total_deductions = (
            payroll_item.nssf + payroll_item.shif
            + payroll_item.ahl + payroll_item.paye
        )
        deductions_data = [
            [Paragraph("<b>Deductions Description</b>", label_style),
             Paragraph("<b>Amount (KES)</b>", label_style)],
            [Paragraph("National Social Security Fund (NSSF)", value_style),
             Paragraph(f"{payroll_item.nssf:,.2f}", value_style)],
            [Paragraph("Social Health Insurance Fund (SHIF)", value_style),
             Paragraph(f"{payroll_item.shif:,.2f}", value_style)],
            [Paragraph("Affordable Housing Levy (AHL)", value_style),
             Paragraph(f"{payroll_item.ahl:,.2f}", value_style)],
            [Paragraph("KRA Pay As You Earn (PAYE)", value_style),
             Paragraph(f"{payroll_item.paye:,.2f}", value_style)],
            [Paragraph("<b>Total Deductions (B)</b>", label_style),
             Paragraph(f"<b>{total_deductions:,.2f}</b>", label_style)],
        ]
        deductions_table = Table(deductions_data, colWidths=[380, 160])
        deductions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('ALIGN',      (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING',    (0, 0), (-1, -1), 6),
            ('BOX',        (0, 0), (-1, -1), 0.5, border_color),
            ('LINEBELOW',  (0, -1), (-1, -1), 1, colors.HexColor('#ef4444')),
            ('INNERGRID',  (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(deductions_table)
        story.append(Spacer(1, 15))

        net_table = Table(
            [[Paragraph("NET TAKE HOME SALARY (A - B):", label_white_style),
              Paragraph(f"KES {payroll_item.net_pay:,.2f}", value_white_style)]],
            colWidths=[340, 200],
        )
        net_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), primary_color),
            ('ALIGN',      (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING',    (0, 0), (-1, -1), 12),
            ('BOX',        (0, 0), (-1, -1), 1, primary_color),
        ]))
        story.append(net_table)
        story.append(Spacer(1, 25))

        footer_style = ParagraphStyle(
            'PayslipFooter', parent=styles['Normal'],
            fontName='Helvetica-Oblique', fontSize=8,
            textColor=text_muted, alignment=1,
        )
        story.append(Paragraph(
            "This pay slip represents an official legal compensation breakdown "
            "generated and certified by WorkWise compliance systems.",
            footer_style,
        ))
        story.append(Paragraph(
            "Strictly Confidential: Do not disclose this document to third "
            "parties without authorization.",
            footer_style,
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer
