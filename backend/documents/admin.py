from django.contrib import admin
from .models import DocumentCategory, Document, DocumentVersion


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "is_active", "created_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("name", "description")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "document_type", "employee", "tenant", "version", "is_active", "expiry_date")
    list_filter = ("document_type", "is_active", "expiry_date", "created_at")
    search_fields = ("title", "description")


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = ("document", "version", "uploaded_by", "created_at")
    list_filter = ("created_at",)
