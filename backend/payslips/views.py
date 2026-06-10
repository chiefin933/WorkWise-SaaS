import io
import logging
from django.http import FileResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils import timezone

from payroll.models import PayrollItem
from .models import Payslip
from core.tenant_utils import tenant_required

logger = logging.getLogger(__name__)

class DownloadPayslipView(APIView):
    """
    Secure view to dynamically generate and download a branded, highly detailed
    compliance-audited PDF payslip for a given PayrollItem.
    Enforces strict organization boundary checks (Tenant Isolation).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        tenant, err = tenant_required(request)
        if err:
            return err

        try:
            # Enforce tenant isolation strictly
            payroll_item = PayrollItem.objects.get(id=pk, payroll_run__tenant=tenant)
        except PayrollItem.DoesNotExist:
            logger.warning(f"Unauthorized payslip access attempt or invalid pk: {pk} by user {request.user.email}")
            return Response({"error": "Payroll record not found or access denied"}, status=status.HTTP_404_NOT_FOUND)

        # Enforce employee self-only access restriction
        if request.user.role not in ('ADMIN', 'HR') and payroll_item.employee.email != request.user.email:
            logger.warning(f"Access denied: Employee {request.user.email} attempted to fetch payslip for {payroll_item.employee.email}")
            return Response({"error": "You do not have permission to access this payslip."}, status=status.HTTP_403_FORBIDDEN)

        # Track the payslip retrieval/generation
        payslip, _ = Payslip.objects.get_or_create(payroll_item=payroll_item)

        # Initialize PDF generation in memory buffer
        buffer = io.BytesIO()
        
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        
        # Design target document properties
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Curated HSL-derived palette (Premium Teal & Slate Theme)
        primary_color = colors.HexColor('#0d9488')  # Teal-600
        dark_color = colors.HexColor('#1e293b')     # Slate-800
        light_bg = colors.HexColor('#f8fafc')       # Slate-50
        border_color = colors.HexColor('#cbd5e1')   # Slate-300
        text_dark = colors.HexColor('#0f172a')      # Slate-900
        text_muted = colors.HexColor('#64748b')     # Slate-500
        
        title_style = ParagraphStyle(
            'PayslipTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=20,
            textColor=primary_color,
            spaceAfter=4
        )
        
        subtitle_style = ParagraphStyle(
            'PayslipSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=text_muted,
            spaceAfter=15
        )
        
        header_style = ParagraphStyle(
            'SectionHeader',
            fontName='Helvetica-Bold',
            fontSize=11,
            textColor=dark_color,
            spaceAfter=6
        )
        
        label_style = ParagraphStyle(
            'FieldLabel',
            fontName='Helvetica-Bold',
            fontSize=9,
            textColor=colors.HexColor('#475569')
        )
        
        value_style = ParagraphStyle(
            'FieldValue',
            fontName='Helvetica',
            fontSize=9,
            textColor=text_dark
        )

        value_white_style = ParagraphStyle(
            'FieldValueWhite',
            fontName='Helvetica-Bold',
            fontSize=12,
            textColor=colors.white
        )

        label_white_style = ParagraphStyle(
            'FieldLabelWhite',
            fontName='Helvetica-Bold',
            fontSize=11,
            textColor=colors.white
        )

        # Branded Header Block
        story.append(Paragraph("WORKWISE HR & PAYROLL SYSTEMS", title_style))
        story.append(Paragraph(f"OFFICIAL PAY COMPLIANCE STATEMENT - {payroll_item.payroll_run.month}/{payroll_item.payroll_run.year}", subtitle_style))
        
        # Details Grid Layout (Tenant & Employee Demographics)
        emp = payroll_item.employee
        details_data = [
            [
                Paragraph("Employee Name:", label_style), Paragraph(emp.name, value_style),
                Paragraph("Organization:", label_style), Paragraph(tenant.name, value_style)
            ],
            [
                Paragraph("Employment Type:", label_style), Paragraph(emp.get_employment_type_display(), value_style),
                Paragraph("KRA PIN:", label_style), Paragraph(emp.kra_pin or 'N/A', value_style)
            ],
            [
                Paragraph("Bank Name:", label_style), Paragraph((emp.bank_details or {}).get('bank_name', 'N/A'), value_style),
                Paragraph("Account Number:", label_style), Paragraph((emp.bank_details or {}).get('account_number', 'N/A'), value_style)
            ],
            [
                Paragraph("Date Generated:", label_style), Paragraph(timezone.now().strftime('%Y-%m-%d'), value_style),
                Paragraph("Payment Method:", label_style), Paragraph(emp.get_payment_method_display(), value_style)
            ]
        ]
        
        details_table = Table(details_data, colWidths=[110, 160, 100, 170])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), light_bg),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 8),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(details_table)
        story.append(Spacer(1, 15))
        
        # Earnings Section
        story.append(Paragraph("1. COMPENSATIONS & EARNINGS", header_style))
        
        from decimal import Decimal
        base_salary = emp.salary_basic
        allowances = emp.allowances or {}
        allowances_total = sum(Decimal(str(v)) for v in allowances.values()) if allowances else Decimal('0.00')
        
        earnings_data = [
            [Paragraph("<b>Earnings Description</b>", label_style), Paragraph("<b>Amount (KES)</b>", label_style)],
            [Paragraph("Basic Contracted Salary", value_style), Paragraph(f"{base_salary:,.2f}", value_style)],
        ]
        
        # Loop allowances if any exist
        for k, v in allowances.items():
            earnings_data.append([Paragraph(f"Allowance: {k}", value_style), Paragraph(f"{float(v):,.2f}", value_style)])
            
        # Overtime & Unpaid Leave calculations compared to calculated gross
        overtime_and_unpaid_diff = payroll_item.gross_salary - base_salary - allowances_total
        if overtime_and_unpaid_diff > 0:
            earnings_data.append([Paragraph("Overtime & Punctuality Adjustments", value_style), Paragraph(f"{overtime_and_unpaid_diff:,.2f}", value_style)])
        elif overtime_and_unpaid_diff < 0:
            earnings_data.append([Paragraph("Unpaid Leave Deductions", value_style), Paragraph(f"{abs(overtime_and_unpaid_diff):,.2f}", value_style)])
            
        earnings_data.append([Paragraph("<b>Total Gross Earnings (A)</b>", label_style), Paragraph(f"<b>{payroll_item.gross_salary:,.2f}</b>", label_style)])
        
        earnings_table = Table(earnings_data, colWidths=[380, 160])
        earnings_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 6),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('LINEBELOW', (0,-1), (-1,-1), 1, primary_color),
            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(earnings_table)
        story.append(Spacer(1, 12))
        
        # Statutory Deductions Section
        story.append(Paragraph("2. MANDATORY STATUTORY DEDUCTIONS", header_style))
        
        deductions_data = [
            [Paragraph("<b>Deductions Description</b>", label_style), Paragraph("<b>Amount (KES)</b>", label_style)],
            [Paragraph("National Social Security Fund (NSSF)", value_style), Paragraph(f"{payroll_item.nssf:,.2f}", value_style)],
            [Paragraph("Social Health Insurance Fund (SHIF)", value_style), Paragraph(f"{payroll_item.shif:,.2f}", value_style)],
            [Paragraph("Affordable Housing Levy (AHL)", value_style), Paragraph(f"{payroll_item.ahl:,.2f}", value_style)],
            [Paragraph("KRA Pay As You Earn (PAYE)", value_style), Paragraph(f"{payroll_item.paye:,.2f}", value_style)],
        ]
        
        total_deductions = payroll_item.nssf + payroll_item.shif + payroll_item.ahl + payroll_item.paye
        deductions_data.append([Paragraph("<b>Total Deductions (B)</b>", label_style), Paragraph(f"<b>{total_deductions:,.2f}</b>", label_style)])
        
        deductions_table = Table(deductions_data, colWidths=[380, 160])
        deductions_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 6),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('LINEBELOW', (0,-1), (-1,-1), 1, colors.HexColor('#ef4444')), # Crimson red indicator
            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        story.append(deductions_table)
        story.append(Spacer(1, 15))
        
        # Net Take Home Pay Highlight Panel
        net_data = [
            [Paragraph("NET TAKE HOME SALARY (A - B):", label_white_style),
             Paragraph(f"KES {payroll_item.net_pay:,.2f}", value_white_style)]
        ]
        net_table = Table(net_data, colWidths=[340, 200])
        net_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), primary_color),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 12),
            ('BOX', (0,0), (-1,-1), 1, primary_color),
        ]))
        story.append(net_table)
        story.append(Spacer(1, 25))
        
        # Document Footer Notes
        footer_style = ParagraphStyle(
            'PayslipFooter',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=8,
            textColor=text_muted,
            alignment=1
        )
        story.append(Paragraph("This pay slip represents an official legal compensation breakdown generated and certified by WorkWise compliance systems.", footer_style))
        story.append(Paragraph("Strictly Confidential: Do not disclose this document to third parties without authorization.", footer_style))
        
        # Render the PDF document
        doc.build(story)
        
        # Reset stream pointer
        buffer.seek(0)
        
        # Compile response to client
        safe_emp_name = emp.name.replace(' ', '_').lower()
        response = FileResponse(
            buffer,
            as_attachment=True,
            filename=f"payslip_{safe_emp_name}_{payroll_item.payroll_run.month}_{payroll_item.payroll_run.year}.pdf"
        )
        response['Content-Type'] = 'application/pdf'
        return response
