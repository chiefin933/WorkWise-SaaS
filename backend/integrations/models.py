import uuid
import hmac
import hashlib
from django.db import models
from django.utils import timezone
from django.utils.crypto import get_random_string
from tenants.models import Tenant
from core.tenant_models import TenantScopedModel
from users.models import User


class APIKey(TenantScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=255)
    key = models.CharField(max_length=100, unique=True, editable=False)
    secret = models.CharField(max_length=100, unique=True, editable=False)
    permissions = models.JSONField(default=list, help_text="Permissions granted to this API key")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_api_keys")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = get_random_string(50)
        if not self.secret:
            self.secret = get_random_string(50)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return self.expires_at and self.expires_at < timezone.now()

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "key"]),
        ]

    def __str__(self):
        return f"API Key: {self.name} ({self.tenant.name})"


class Webhook(TenantScopedModel):
    TRIGGER_EVENTS = [
        ("employee.created", "Employee Created"),
        ("employee.updated", "Employee Updated"),
        ("employee.deleted", "Employee Deleted"),
        ("leave.approved", "Leave Approved"),
        ("leave.rejected", "Leave Rejected"),
        ("payroll.completed", "Payroll Completed"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="webhooks")
    name = models.CharField(max_length=255)
    url = models.URLField()
    secret = models.CharField(max_length=100, blank=True, default="")
    events = models.JSONField(default=list, help_text="List of events that trigger this webhook")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_webhooks")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def generate_signature(self, payload: str):
        if not self.secret:
            return ""
        return hmac.new(
            self.secret.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "url"]),
        ]

    def __str__(self):
        return f"Webhook: {self.name} ({self.url})"


class WebhookLog(TenantScopedModel):
    STATUS_CHOICES = [
        ("success", "Success"),
        ("failed", "Failed"),
        ("pending", "Pending"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="webhook_logs")
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name="logs")
    event = models.CharField(max_length=100)
    payload = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    status_code = models.IntegerField(null=True, blank=True)
    response = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["webhook", "status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.event} — {self.status} ({self.created_at})"
