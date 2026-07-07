import uuid
from django.db import models
from tenants.models import Tenant
from employees.models import Employee
from core.tenant_models import TenantScopedModel
from users.models import User


class DocumentCategory(TenantScopedModel):
    """Category for organizing documents (e.g., ID, Contracts, Certificates)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='document_categories')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'name']),
        ]

    def __str__(self):
        return f"{self.name}"


class Document(TenantScopedModel):
    """Uploaded document with version history, permissions, and expiry dates"""
    DOCUMENT_TYPES = [
        ('national_id', 'National ID'),
        ('passport', 'Passport'),
        ('cv', 'CV'),
        ('certificate', 'Certificate'),
        ('contract', 'Contract'),
        ('nda', 'NDA'),
        ('kra_pin', 'KRA PIN'),
        ('nssf', 'NSSF Document'),
        ('shif', 'SHIF Document'),
        ('warning_letter', 'Warning Letter'),
        ('other', 'Other'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='documents')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents', null=True, blank=True)
    category = models.ForeignKey(DocumentCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES, default='other')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    file = models.FileField(upload_to='documents/%Y/%m/%d/')
    file_size = models.PositiveIntegerField(help_text="File size in bytes")
    file_type = models.CharField(max_length=100, help_text="MIME type of the file")
    version = models.PositiveIntegerField(default=1)
    expiry_date = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents')
    # Permissions: who can view this document
    viewable_by_roles = models.JSONField(default=list, help_text="Roles that can view this document")
    viewable_by_users = models.ManyToManyField(User, related_name='shared_documents', blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'employee']),
            models.Index(fields=['tenant', 'document_type']),
            models.Index(fields=['tenant', 'expiry_date']),
        ]

    def __str__(self):
        return f"{self.title} (v{self.version})"


class DocumentVersion(TenantScopedModel):
    """Version history for documents"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='versions')
    version = models.PositiveIntegerField()
    file = models.FileField(upload_to='documents/versions/%Y/%m/%d/')
    file_size = models.PositiveIntegerField()
    file_type = models.CharField(max_length=100)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_document_versions')
    change_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']
        constraints = [
            models.UniqueConstraint(fields=['document', 'version'], name='unique_document_version'),
        ]

    def __str__(self):
        return f"{self.document.title} v{self.version}"
