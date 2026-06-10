from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from .models import User
from tenants.models import Tenant
from payroll.models import PayrollConfig
from django.db import transaction

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['tenant_id'] = str(user.tenant.id) if user.tenant else None
        token['role'] = user.role
        return token

class UserRegistrationSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(write_only=True)
    plan = serializers.CharField(write_only=True, required=False, default='STARTER')
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('email', 'password', 'company_name', 'first_name', 'last_name', 'plan')

    @transaction.atomic
    def create(self, validated_data):
        company_name = validated_data.pop('company_name')
        plan = validated_data.pop('plan', 'STARTER')
        password = validated_data.pop('password')
        
        # Create Tenant
        tenant = Tenant.objects.create(name=company_name, plan=plan)
        
        # Create default Payroll Config for the new tenant
        PayrollConfig.objects.create(tenant=tenant)
        
        # Create Admin User
        user = User.objects.create_user(
            email=validated_data['email'],
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            tenant=tenant,
            role='ADMIN'
        )
        return user

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
            'trial_ends_at', 'kra_pin', 'tenant_id',
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
