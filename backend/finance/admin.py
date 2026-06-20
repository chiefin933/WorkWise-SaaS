from django.contrib import admin
from .models import ExpenseClaim, DepartmentBudget, PettyCashFund, PettyCashTransaction


@admin.register(ExpenseClaim)
class ExpenseClaimAdmin(admin.ModelAdmin):
    list_display  = ('title', 'employee', 'category', 'amount', 'status', 'expense_date', 'reviewed_by', 'created_at')
    list_filter   = ('status', 'category', 'expense_date')
    search_fields = ('title', 'employee__name', 'submitted_by__email')
    readonly_fields = ('submitted_by', 'reviewed_by', 'reviewed_at', 'paid_at', 'created_at', 'updated_at')
    ordering      = ('-created_at',)
    list_per_page = 50

    fieldsets = (
        ('Claim Details', {
            'fields': ('tenant', 'employee', 'submitted_by', 'title', 'category', 'amount', 'currency', 'expense_date', 'description', 'receipt_url'),
        }),
        ('Approval', {
            'fields': ('status', 'reviewed_by', 'review_comment', 'reviewed_at', 'paid_at'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(DepartmentBudget)
class DepartmentBudgetAdmin(admin.ModelAdmin):
    list_display  = ('department', 'period_month', 'period_year', 'budget_amount', 'created_by', 'created_at')
    list_filter   = ('period_year', 'period_month')
    search_fields = ('department', 'tenant__name')
    readonly_fields = ('created_by', 'created_at', 'updated_at')
    ordering      = ('-period_year', '-period_month', 'department')


@admin.register(PettyCashFund)
class PettyCashFundAdmin(admin.ModelAdmin):
    list_display  = ('name', 'tenant', 'opening_balance', 'current_balance', 'custodian', 'is_active', 'created_at')
    list_filter   = ('is_active',)
    search_fields = ('name', 'tenant__name')
    readonly_fields = ('current_balance', 'created_at', 'updated_at')


@admin.register(PettyCashTransaction)
class PettyCashTransactionAdmin(admin.ModelAdmin):
    list_display  = ('purpose', 'fund', 'transaction_type', 'amount', 'requested_by', 'status', 'approved_by', 'created_at')
    list_filter   = ('status', 'transaction_type')
    search_fields = ('purpose', 'requested_by__email', 'fund__name')
    readonly_fields = ('requested_by', 'approved_by', 'approved_at', 'disbursed_at', 'created_at', 'updated_at')
    ordering      = ('-created_at',)
