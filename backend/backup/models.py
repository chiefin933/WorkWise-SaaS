import uuid
from django.db import models
from tenants.models import Tenant
from core.tenant_models import TenantScopedModel
from users.models import User


class TenantBackup(TenantScopedModel):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="backups")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    file = models.FileField(upload_to="tenant_backups/", null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    error_message = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_backups")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "status", "created_at"]),
        ]

    def __str__(self):
        return f"Backup: {self.name} ({self.tenant.name})"
