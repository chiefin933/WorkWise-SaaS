from django.contrib import admin
from .models import CustomReport, ReportExport


@admin.register(CustomReport)
class CustomReportAdmin(admin.ModelAdmin):
    list_display = ("name", "report_type", "tenant", "created_by", "created_at")
    list_filter = ("report_type", "created_at")
    search_fields = ("name", "description")


@admin.register(ReportExport)
class ReportExportAdmin(admin.ModelAdmin):
    list_display = ("id", "custom_report", "export_format", "status", "tenant", "created_at")
    list_filter = ("export_format", "status", "created_at")
