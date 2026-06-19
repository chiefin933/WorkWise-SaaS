import uuid
from decimal import Decimal
from django.db import models
from employees.models import Employee
from core.tenant_models import TenantScopedModel

class Attendance(TenantScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    clock_in = models.TimeField(null=True, blank=True)
    clock_out = models.TimeField(null=True, blank=True)
    hours_worked = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    location = models.CharField(max_length=100, default='Office', null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # employee already implies a single tenant, so this constraint is sufficient for tenant isolation
        unique_together = ('employee', 'date')
        indexes = [
            models.Index(fields=['employee', 'date'], name='att_employee_date_idx'),
            models.Index(fields=['date'], name='att_date_idx'),
        ]

    def save(self, *args, **kwargs):
        if self.clock_in and self.clock_out:
            import datetime
            # Convert time to datetime objects for subtraction
            d1 = datetime.datetime.combine(self.date, self.clock_in)
            d2 = datetime.datetime.combine(self.date, self.clock_out)
            
            diff = d2 - d1
            total_seconds = diff.total_seconds()
            
            # Hours worked
            hours = Decimal(str(total_seconds / 3600))
            self.hours_worked = round(hours, 2)
            
            # Overtime (anything above 8 hours)
            if self.hours_worked > 8:
                self.overtime_hours = self.hours_worked - 8
            else:
                self.overtime_hours = 0
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee.name} - {self.date}"
