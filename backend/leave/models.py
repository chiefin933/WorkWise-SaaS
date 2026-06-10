import uuid
from django.db import models
from employees.models import Employee
from core.tenant_models import TenantScopedModel

class Leave(TenantScopedModel):
    LEAVE_TYPES = [
        ('annual', 'Annual Leave'),
        ('sick', 'Sick Leave'),
        ('maternity', 'Maternity Leave'),
        ('paternity', 'Paternity Leave'),
        ('unpaid', 'Unpaid Leave'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'status'], name='leave_employee_status_idx'),
            models.Index(fields=['employee', 'start_date'], name='leave_employee_date_idx'),
            models.Index(fields=['start_date', 'end_date'], name='leave_date_range_idx'),
        ]

    def __str__(self):
        return f"{self.employee.name} - {self.leave_type} ({self.status})"
