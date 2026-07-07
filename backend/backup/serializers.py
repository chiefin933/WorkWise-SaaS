from rest_framework import serializers
from .models import TenantBackup


class TenantBackupSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantBackup
        fields = "__all__"
        read_only_fields = ("id", "file", "status", "error_message", "created_at", "updated_at")
