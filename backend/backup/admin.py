from django.contrib import admin
from .models import TenantBackup


@admin.register(TenantBackup)
class TenantBackupAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "status", "created_by", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("name",)
