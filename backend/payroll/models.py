import uuid
from decimal import Decimal
from django.db import models
from tenants.models import Tenant
from employees.models import Employee
from core.tenant_models import TenantScopedModel

class PayrollRun(TenantScopedModel):
    STATUS_CHOICES = [
        ('draft',     'Draft'),
        ('processed', 'Processed'),
        ('approved',  'Approved'),
        ('paid',      'Paid'),
        ('reversed',  'Reversed'),
    ]

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant   = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='payroll_runs')
    month    = models.IntegerField()
    year     = models.IntegerField()
    status   = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    reversed_by = models.OneToOneField(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reversal_of',
        help_text='Points to the corrective run that reversed this run.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Removed unique_together — a month can have multiple runs when the original
        # is reversed and a corrective run is created for the same period.
        # Uniqueness is enforced at the application level: only one non-reversed
        # run is allowed per (tenant, month, year) at a time.
        indexes = [
            models.Index(fields=['tenant', 'status'], name='pr_tenant_status_idx'),
            models.Index(fields=['tenant', 'year', 'month'], name='pr_tenant_period_idx'),
        ]

    def __str__(self):
        return f"{self.tenant.name} - {self.month}/{self.year} ({self.status})"

# PayrollItem is tenant-scoped via payroll_run -> PayrollRun -> tenant FK chain. No direct tenant FK needed.
class PayrollItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll_run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name='items')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payroll_items')

    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    nssf = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    shif = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    ahl = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    paye = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # ── Payslip S3 storage ────────────────────────────────────────────────────
    # Populated by send_payslips_async after the PDF is uploaded to S3.
    # Format: payslips/{tenant_id}/{year}/{month}/{employee_id}.pdf
    # When set, DownloadPayslipView generates a 5-minute pre-signed URL instead
    # of regenerating the PDF on every request.
    payslip_s3_key = models.CharField(
        max_length=512,
        blank=True,
        default='',
        help_text='S3 object key for the stored payslip PDF (empty = not yet uploaded).',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['payroll_run', 'employee'], name='pi_run_employee_idx'),
        ]

class PayrollConfig(TenantScopedModel):
    NSSF_ACT_CHOICES = [
        ('new', 'New NSSF Act 2013 (Tier I + Tier II)'),
        ('old', 'Old NSSF Act (Flat KES 200)'),
    ]

    tenant          = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='payroll_config')

    # ── NSSF ──────────────────────────────────────────────────────────────────
    # nssf_act: 'new' = NSSF Act 2013 Tier I+II; 'old' = flat KES 200
    # Courts have issued injunctions on the new Act — toggle as needed
    nssf_act        = models.CharField(max_length=5, choices=NSSF_ACT_CHOICES, default='new')
    nssf_rate       = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.0600'))
    nssf_lel        = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('7000.00'),
                                          help_text='NSSF Lower Earnings Limit (Tier I ceiling)')
    nssf_uel        = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('36000.00'),
                                          help_text='NSSF Upper Earnings Limit (Tier II ceiling)')
    nssf_cap        = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('4320.00'),
                                          help_text='Legacy cap field (kept for reference; engine uses lel/uel)')

    # ── SHIF ──────────────────────────────────────────────────────────────────
    shif_rate       = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.0275'))
    shif_min        = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('300.00'),
                                          help_text='Minimum SHIF deduction per month (KES 300)')

    # ── Housing Levy ──────────────────────────────────────────────────────────
    ahl_rate        = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.0150'))

    # ── PAYE ──────────────────────────────────────────────────────────────────
    personal_relief = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('2400.00'))
    paye_bands      = models.JSONField(default=list,
                                       help_text='[{"limit": 24000, "rate": 0.10}, ...] — empty = KRA 2024/2025 defaults')

    # ── Attendance / Geofencing ───────────────────────────────────────────────
    office_latitude        = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    office_longitude       = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geofence_radius_meters = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Geofence radius in metres around the office. Leave blank to disable.',
    )

    def __str__(self):
        return f"Payroll Config — {self.tenant.name}"


class MpesaTransaction(models.Model):
    """Tracks per-employee M-Pesa B2C disbursement status for a payroll run."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed',  'Failed'),
        ('timeout', 'Timeout'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll_run = models.ForeignKey(
        PayrollRun, on_delete=models.CASCADE, related_name='mpesa_transactions'
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='mpesa_transactions'
    )
    phone_number = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Daraja B2C response fields
    conversation_id = models.CharField(max_length=100, blank=True, default='')
    originator_conversation_id = models.CharField(max_length=100, blank=True, default='')
    result_code = models.CharField(max_length=10, blank=True, default='')
    result_desc = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['payroll_run', 'status'], name='mpesa_run_status_idx'),
            models.Index(fields=['conversation_id'], name='mpesa_conv_id_idx'),
        ]

    def __str__(self):
        return f"M-Pesa: {self.employee.name} — {self.amount} ({self.status})"
