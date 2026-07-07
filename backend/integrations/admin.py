from django.contrib import admin
from .models import APIKey, Webhook, WebhookLog


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "is_active", "expires_at", "created_by", "created_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("name",)


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ("name", "url", "tenant", "is_active", "created_by", "created_at")
    list_filter = ("is_active", "created_at")


@admin.register(WebhookLog)
class WebhookLogAdmin(admin.ModelAdmin):
    list_display = ("event", "webhook", "status", "tenant", "created_at")
    list_filter = ("status", "created_at")
