from rest_framework import serializers
from .models import Tenant
from payroll.models import PayrollConfig


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = (
            'id', 'name', 'country', 'currency', 'plan',
            'subscription_status', 'max_employees', 'trial_ends_at',
            'kra_pin', 'address', 'phone', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'plan', 'subscription_status', 'max_employees', 'trial_ends_at', 'created_at', 'updated_at')


class PayrollConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollConfig
        fields = (
            'nssf_rate', 'nssf_cap', 'shif_rate', 'shif_min',
            'ahl_rate', 'personal_relief', 'paye_bands',
        )
