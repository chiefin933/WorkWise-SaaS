import uuid
from decimal import Decimal
from django.db import models
from employees.models import Employee
from core.tenant_models import TenantScopedModel


class Attendance(TenantScopedModel):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee     = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendances')
    date         = models.DateField()
    clock_in     = models.TimeField(null=True, blank=True)
    clock_out    = models.TimeField(null=True, blank=True)
    hours_worked     = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    overtime_hours   = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    # True when this day is a Kenya public holiday — overtime rate = 2x instead of 1.5x
    is_public_holiday = models.BooleanField(default=False)
    # True when this day falls on a Sunday — overtime rate = 2x
    is_sunday        = models.BooleanField(default=False)

    location  = models.CharField(max_length=100, default='Office', null=True, blank=True)
    latitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('employee', 'date')
        indexes = [
            models.Index(fields=['employee', 'date'], name='att_employee_date_idx'),
            models.Index(fields=['date'],              name='att_date_idx'),
        ]

    def save(self, *args, **kwargs):
        # ── Flag public holiday and Sunday ────────────────────────────────────
        if self.date:
            from core.kenya_holidays import is_public_holiday
            self.is_public_holiday = is_public_holiday(self.date)
            self.is_sunday = self.date.weekday() == 6  # 6 = Sunday

        # ── Calculate hours worked ────────────────────────────────────────────
        if self.clock_in and self.clock_out:
            import datetime as _dt
            d1 = _dt.datetime.combine(self.date, self.clock_in)
            d2 = _dt.datetime.combine(self.date, self.clock_out)
            diff = d2 - d1
            hours = Decimal(str(diff.total_seconds() / 3600))
            self.hours_worked  = round(hours, 2)
            self.overtime_hours = max(Decimal('0'), self.hours_worked - Decimal('8'))

        super().save(*args, **kwargs)

    @property
    def overtime_rate(self) -> float:
        """Returns the applicable overtime multiplier for this day."""
        if self.is_public_holiday or self.is_sunday:
            return 2.0
        return 1.5

    def __str__(self):
        return f"{self.employee.name} — {self.date}"
