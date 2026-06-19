from rest_framework import serializers
from .models import User, Notification

class UserSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()
    plan = serializers.SerializerMethodField()
    subscription_status = serializers.SerializerMethodField()
    max_employees = serializers.SerializerMethodField()
    trial_ends_at = serializers.SerializerMethodField()
    kra_pin = serializers.SerializerMethodField()
    tenant_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 'role',
            'company_name', 'plan', 'subscription_status', 'max_employees',
            'trial_ends_at', 'kra_pin', 'tenant_id', 'notification_preferences',
        )
        read_only_fields = ('id', 'email', 'role')

    def get_kra_pin(self, obj):
        return obj.tenant.kra_pin if obj.tenant else ''

    def get_tenant_id(self, obj):
        return str(obj.tenant.id) if obj.tenant else None

    def get_company_name(self, obj):
        return obj.tenant.name if obj.tenant else "No Company"

    def get_plan(self, obj):
        return obj.tenant.plan if obj.tenant else "N/A"

    def get_subscription_status(self, obj):
        return obj.tenant.subscription_status if obj.tenant else "N/A"

    def get_max_employees(self, obj):
        return obj.tenant.max_employees if obj.tenant else 0

    def get_trial_ends_at(self, obj):
        return obj.tenant.trial_ends_at if obj.tenant else None


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            'id', 'tenant', 'recipient', 'type', 'title',
            'message', 'is_read', 'action_url', 'created_at'
        )
        read_only_fields = ('id', 'tenant', 'recipient', 'created_at')

