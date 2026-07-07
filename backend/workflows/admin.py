from django.contrib import admin
from .models import ApprovalTemplate, ApprovalStep, ApprovalRequest, ApprovalAction


@admin.register(ApprovalTemplate)
class ApprovalTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "workflow_type", "tenant", "is_active", "created_at")
    list_filter = ("workflow_type", "is_active", "created_at")
    search_fields = ("name", "description")


@admin.register(ApprovalStep)
class ApprovalStepAdmin(admin.ModelAdmin):
    list_display = ("template", "order", "name", "approver_type", "requires_comment")
    list_filter = ("approver_type", "requires_comment")


@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "workflow_type", "status", "requester", "tenant", "created_at")
    list_filter = ("workflow_type", "status", "created_at")
    search_fields = ("title", "description")


@admin.register(ApprovalAction)
class ApprovalActionAdmin(admin.ModelAdmin):
    list_display = ("request", "action_type", "actor", "created_at")
    list_filter = ("action_type", "created_at")
