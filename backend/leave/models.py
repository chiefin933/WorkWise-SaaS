import uuid
from decimal import Decimal
from django.db import models
from employees.models import Employee
from core.tenant_models import TenantScopedModel


# ── Leave Types (shared constant) ─────────────────────────────────────────────
LEAVE_TYPES = [
    ('annual', 'Annual Leave'),
    ('sick', 'Sick Leave'),
    ('maternity', 'Maternity Leave'),
    ('paternity', 'Paternity Leave'),
    ('unpaid', 'Unpaid Leave'),
]


class LeavePolicy(TenantScopedModel):
    """
    Tenant-level leave entitlement configuration.
    Replaces the hardcoded policy dict scattered across views.

    One record per tenant (enforced via OneToOneField on Tenant).
    HR/Admin can update entitlements from the Settings page.
    """
    from tenants.models import Tenant

    tenant = models.OneToOneField(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='leave_policy',
    )
    annual_days      = models.PositiveIntegerField(default=21)
    sick_days        = models.PositiveIntegerField(default=30)
    maternity_days   = models.PositiveIntegerField(default=90)
    paternity_days   = models.PositiveIntegerField(default=14)
    # Unpaid leave has no cap — stored as None in the policy helpers
    notice_days      = models.PositiveIntegerField(default=14,
                           help_text="Minimum advance notice required for leave requests.")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Leave Policy'
        verbose_name_plural = 'Leave Policies'

    def get_limit(self, leave_type: str):
        """Return the day limit for a leave type, or None for unpaid."""
        mapping = {
            'annual':    self.annual_days,
            'sick':      self.sick_days,
            'maternity': self.maternity_days,
            'paternity': self.paternity_days,
            'unpaid':    None,
        }
        return mapping.get(leave_type)

    def as_dict(self) -> dict:
        return {
            'annual':    self.annual_days,
            'sick':      self.sick_days,
            'maternity': self.maternity_days,
            'paternity': self.paternity_days,
            'notice_days': self.notice_days,
        }

    def __str__(self):
        return f"Leave Policy – {self.tenant.name}"


class Leave(TenantScopedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('manager_approved', 'Manager Approved'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leaves')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPES, default='annual')
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reason = models.CharField(max_length=500, blank=True, default='')

    # Multi-level approval fields
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='approved_leaves',
        help_text="HR/Admin who gave final approval or rejection.",
    )
    manager_approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='manager_approved_leaves',
        help_text="Line manager who gave first-stage approval.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'status'], name='leave_employee_status_idx'),
            models.Index(fields=['employee', 'start_date'], name='leave_employee_date_idx'),
            models.Index(fields=['start_date', 'end_date'], name='leave_date_range_idx'),
        ]

    @property
    def days_requested(self) -> int:
        return (self.end_date - self.start_date).days + 1

    def __str__(self):
        return f"{self.employee.name} - {self.leave_type} ({self.status})"


class LeaveBalance(TenantScopedModel):
    """
    Persisted leave balance record per employee, per type, per calendar year.

    `used_days` is updated by a Django signal whenever a Leave transitions
    to 'approved' (or is un-approved back to pending/rejected).
    `entitled_days` is seeded from the tenant's LeavePolicy on creation and
    can be overridden for individual employees.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='leave_balances'
    )
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPES)
    year = models.PositiveIntegerField()
    entitled_days = models.DecimalField(max_digits=6, decimal_places=1, default=Decimal('0.0'))
    used_days     = models.DecimalField(max_digits=6, decimal_places=1, default=Decimal('0.0'))

    class Meta:
        unique_together = ('employee', 'leave_type', 'year')
        indexes = [
            models.Index(fields=['employee', 'year'], name='lb_employee_year_idx'),
        ]

    @property
    def remaining_days(self) -> Decimal:
        return max(Decimal('0.0'), self.entitled_days - self.used_days)

    def __str__(self):
        return (
            f"{self.employee.name} – {self.leave_type} {self.year}: "
            f"{self.used_days}/{self.entitled_days} used"
        )
