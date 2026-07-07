from rest_framework import serializers
from .models import CustomReport, ReportExport


class CustomReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomReport
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class ReportExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportExport
        fields = "__all__"
        read_only_fields = ("id", "status", "file", "error_message", "created_at", "updated_at")
