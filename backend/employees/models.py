import uuid
from django.db import models
from tenants.models import Tenant
from core.encryption import EncryptedCharField, EncryptedJSONField
from core.tenant_models import TenantScopedModel

class Employee(TenantScopedModel):
    EMPLOYMENT_TYPES = [
        ('monthly', 'Monthly'),
        ('weekly', 'Weekly'),
        ('daily', 'Daily'),
        ('hourly', 'Hourly'),
    ]
    PAYMENT_METHODS = [
        ('mpesa', 'M-Pesa'),
        ('bank', 'Bank Transfer'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('terminated', 'Terminated'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='employees')
    name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    department = models.CharField(max_length=100, blank=True, default='')
    job_title = models.CharField(max_length=100, blank=True, default='')

    # ── Kenya statutory identifiers ───────────────────────────────────────────
    kra_pin         = EncryptedCharField(blank=True, default='',
                                         help_text='KRA Personal Identification Number')
    national_id     = EncryptedCharField(blank=True, default='',
                                          help_text='National ID / Alien ID / Passport number (encrypted)')
    nssf_number     = models.CharField(max_length=50, blank=True, default='',
                                        help_text='NSSF membership number — required for remittance schedule')
    shif_number     = models.CharField(max_length=50, blank=True, default='',
                                        help_text='SHIF/NHIF membership number — required for SHIF schedule')
    payroll_number  = models.CharField(max_length=50, blank=True, default='',
                                        help_text='Internal payroll/employee number')
    nationality     = models.CharField(max_length=60, blank=True, default='Kenyan',
                                        help_text='Affects PAYE treatment (expats may have different rules)')
    county          = models.CharField(max_length=60, blank=True, default='',
                                        help_text='County of residence / work station')
    work_permit_number = models.CharField(max_length=100, blank=True, default='',
                                           help_text='Required for non-citizen employees')

    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPES, default='monthly')
    salary_basic = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    allowances = models.JSONField(default=dict, blank=True) # e.g. {"house": 5000, "transport": 3000}

    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='bank')
    mpesa_number = EncryptedCharField(null=True, blank=True)
    bank_details = EncryptedJSONField(default=dict, blank=True) # e.g. {"bank_name": "KCB", "account_number": "123"}

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    hire_date = models.DateField(null=True, blank=True)
    termination_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'status'], name='emp_tenant_status_idx'),
            models.Index(fields=['tenant', 'department'], name='emp_tenant_dept_idx'),
            models.Index(fields=['tenant', 'created_at'], name='emp_tenant_created_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'email'],
                condition=models.Q(email__isnull=False) & ~models.Q(email=''),
                name='unique_employee_email_per_tenant',
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.tenant.name})"
