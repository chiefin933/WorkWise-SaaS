import uuid
from django.db import models
from payroll.models import PayrollItem

class Payslip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll_item = models.OneToOneField(PayrollItem, on_delete=models.CASCADE, related_name='payslip')
    pdf_url = models.URLField(max_length=500, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payslip for {self.payroll_item.employee.name}"
