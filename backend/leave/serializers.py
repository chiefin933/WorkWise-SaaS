from rest_framework import serializers
from .models import Leave, LeaveBalance, LeavePolicy


class LeaveSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    days_requested = serializers.IntegerField(read_only=True)
    approved_by_email = serializers.EmailField(
        source='approved_by.email', read_only=True, default=None
    )
    manager_approved_by_email = serializers.EmailField(
        source='manager_approved_by.email', read_only=True, default=None
    )

    class Meta:
        model = Leave
        fields = '__all__'
        read_only_fields = ('approved_by', 'manager_approved_by')


class LeaveBalanceSerializer(serializers.ModelSerializer):
    remaining_days = serializers.DecimalField(
        max_digits=6, decimal_places=1, read_only=True
    )
    employee_name = serializers.CharField(source='employee.name', read_only=True)

    class Meta:
        model = LeaveBalance
        fields = (
            'id', 'employee', 'employee_name',
            'leave_type', 'year',
            'entitled_days', 'used_days', 'remaining_days',
        )
        read_only_fields = ('used_days', 'remaining_days')


class LeavePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = LeavePolicy
        fields = (
            'annual_days', 'sick_days', 'maternity_days',
            'paternity_days', 'notice_days',
        )
