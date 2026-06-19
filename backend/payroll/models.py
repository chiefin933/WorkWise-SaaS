import uuid
from django.db import models
from tenants.models import Tenant
from employees.models import Employee
from core.tenant_models import TenantScopedModel

class PayrollRun(TenantScopedModel):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('processed', 'Processed'),
        ('approved', 'Approved'),
        ('paid', 'Paid'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='payroll_runs')
    month = models.IntegerField()
    year = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('tenant', 'month', 'year')
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
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='payroll_config')
    nssf_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0.0600)
    nssf_cap = models.DecimalField(max_digits=10, decimal_places=2, default=4320.00)
    shif_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0.0275)
    shif_min = models.DecimalField(max_digits=10, decimal_places=2, default=300.00)
    ahl_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0.0150)
    personal_relief = models.DecimalField(max_digits=10, decimal_places=2, default=2400.00)
    paye_bands = models.JSONField(default=list) 
    # e.g. [{"limit": 24000, "rate": 0.10}, {"limit": 8333, "rate": 0.25}, ...]

    # ── Attendance / Geofencing ───────────────────────────────────────────────
    # When all three are set, clock-in validates that the employee's submitted
    # GPS coordinates fall within geofence_radius_meters of the office.
    # A breach logs a warning and includes a 'geofence_warning' field in the
    # clock-in response — it does NOT block the clock-in.
    office_latitude         = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    office_longitude        = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geofence_radius_meters  = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Geofence radius in metres around the office coordinates. Leave blank to disable.",
    )

    def __str__(self):
        return f"Payroll Config - {self.tenant.name}"


class MpesaTransaction(models.Model):
    """Tracks per-employee M-Pesa B2C disbursement status for a payroll run."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
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
