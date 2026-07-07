import uuid
from django.db import models
from tenants.models import Tenant
from core.tenant_models import TenantScopedModel
from users.models import User


class CustomReport(TenantScopedModel):
    REPORT_TYPES = [
        ("employees", "Employee Report"),
        ("attendance", "Attendance Report"),
        ("leave", "Leave Report"),
        ("payroll", "Payroll Report"),
        ("finance", "Finance Report"),
    ]
    EXPORT_FORMATS = [
        ("csv", "CSV"),
        ("pdf", "PDF"),
        ("xlsx", "Excel (XLSX)"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="custom_reports")
    name = models.CharField(max_length=255)
    report_type = models.CharField(max_length=50, choices=REPORT_TYPES)
    description = models.TextField(blank=True, default="")
    filters = models.JSONField(default=dict, help_text="Report filters (date range, department, etc.)")
    columns = models.JSONField(default=list, help_text="Selected columns for the report")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_reports")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.get_report_type_display()})"


class ReportExport(TenantScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="report_exports")
    custom_report = models.ForeignKey(CustomReport, on_delete=models.CASCADE, related_name="exports", null=True, blank=True)
    export_format = models.CharField(max_length=20, choices=CustomReport.EXPORT_FORMATS)
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("processing", "Processing"), ("completed", "Completed"), ("failed", "Failed")],
        default="pending",
    )
    file = models.FileField(upload_to="report_exports/", null=True, blank=True)
    error_message = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="report_exports")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Export {self.id} — {self.export_format} ({self.status})"
