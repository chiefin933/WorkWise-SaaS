from rest_framework import serializers
from .models import ExpenseClaim, DepartmentBudget, PettyCashFund, PettyCashTransaction


class ExpenseClaimSerializer(serializers.ModelSerializer):
    employee_name     = serializers.CharField(source='employee.name', read_only=True)
    employee_dept     = serializers.CharField(source='employee.department', read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_name  = serializers.SerializerMethodField()
    category_display  = serializers.CharField(source='get_category_display', read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ExpenseClaim
        fields = [
            'id', 'employee', 'employee_name', 'employee_dept',
            'submitted_by', 'submitted_by_name',
            'title', 'category', 'category_display', 'amount', 'currency',
            'expense_date', 'description', 'receipt_url',
            'status', 'status_display',
            'reviewed_by', 'reviewed_by_name', 'review_comment',
            'reviewed_at', 'paid_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'submitted_by', 'submitted_by_name',
            'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'paid_at',
            'created_at', 'updated_at',
        ]

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return obj.submitted_by.get_full_name() or obj.submitted_by.email
        return None

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.email
        return None


class DepartmentBudgetSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DepartmentBudget
        fields = [
            'id', 'department', 'period_month', 'period_year',
            'budget_amount', 'notes',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return None


class PettyCashFundSerializer(serializers.ModelSerializer):
    custodian_name = serializers.SerializerMethodField()

    class Meta:
        model = PettyCashFund
        fields = [
            'id', 'name', 'opening_balance', 'current_balance',
            'custodian', 'custodian_name', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'current_balance', 'created_at', 'updated_at']

    def get_custodian_name(self, obj):
        if obj.custodian:
            return obj.custodian.get_full_name() or obj.custodian.email
        return None


class PettyCashTransactionSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name  = serializers.SerializerMethodField()
    type_display      = serializers.CharField(source='get_transaction_type_display', read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PettyCashTransaction
        fields = [
            'id', 'fund', 'transaction_type', 'type_display',
            'requested_by', 'requested_by_name',
            'amount', 'purpose', 'category', 'receipt_url',
            'status', 'status_display',
            'approved_by', 'approved_by_name', 'approval_comment',
            'approved_at', 'disbursed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'requested_by', 'requested_by_name',
            'approved_by', 'approved_by_name',
            'approved_at', 'disbursed_at',
            'created_at', 'updated_at',
        ]

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.email
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.email
        return None
