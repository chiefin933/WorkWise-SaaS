"""
finance/models.py
-----------------
Three core models for the Finance module:

1. ExpenseClaim   — Employee submits a claim; Finance Manager approves/rejects
2. DepartmentBudget — Finance sets monthly budget per department
3. PettyCash      — Petty cash fund with requests and disbursements
"""

import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from core.tenant_models import TenantScopedModel


# ── 1. Expense Claims ─────────────────────────────────────────────────────────

class ExpenseClaim(TenantScopedModel):
    """
    An employee submits a claim for business expenses.
    Finance Manager reviews and approves/rejects with optional comments.
    """
    CATEGORY_CHOICES = [
        ('travel',        'Travel & Transport'),
        ('accommodation', 'Accommodation'),
        ('meals',         'Meals & Entertainment'),
        ('office',        'Office Supplies'),
        ('client',        'Client Entertainment'),
        ('utilities',     'Utilities'),
        ('training',      'Training & Development'),
        ('medical',       'Medical'),
        ('other',         'Other'),
    ]

    STATUS_CHOICES = [
        ('pending',  'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('paid',     'Reimbursed'),
    ]

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee      = models.ForeignKey('employees.Employee', on_delete=models.CASCADE, related_name='expense_claims')
    submitted_by  = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='submitted_expenses')
    title         = models.CharField(max_length=200)
    category      = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='other')
    amount        = models.DecimalField(max_digits=12, decimal_places=2)
    currency      = models.CharField(max_length=3, default='KES')
    expense_date  = models.DateField()
    description   = models.TextField(blank=True)
    receipt_url   = models.URLField(blank=True)      # S3 key or URL for receipt image

    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by   = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_expenses'
    )
    review_comment = models.TextField(blank=True)
    reviewed_at    = models.DateTimeField(null=True, blank=True)
    paid_at        = models.DateTimeField(null=True, blank=True)

    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee', 'status'], name='exp_emp_status_idx'),
            models.Index(fields=['expense_date'],        name='exp_date_idx'),
        ]

    def __str__(self):
        return f"{self.title} — {self.employee.name} ({self.amount} {self.currency})"


# ── 2. Department Budgets ─────────────────────────────────────────────────────

class DepartmentBudget(TenantScopedModel):
    """
    Finance Manager sets a monthly/annual budget for each department.
    Actual spend is computed dynamically from payroll + approved expenses.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    department   = models.CharField(max_length=100)
    period_month = models.IntegerField()   # 1-12
    period_year  = models.IntegerField()
    budget_amount = models.DecimalField(max_digits=14, decimal_places=2)
    notes        = models.TextField(blank=True)
    created_by   = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='created_budgets'
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-period_year', '-period_month', 'department']
        indexes = [
            models.Index(fields=['period_year', 'period_month'], name='budget_period_idx'),
        ]

    def __str__(self):
        return f"{self.department} — {self.period_month}/{self.period_year} (KES {self.budget_amount:,.0f})"


# ── 3. Petty Cash ─────────────────────────────────────────────────────────────

class PettyCashFund(TenantScopedModel):
    """
    A petty cash fund maintained by the Finance department.
    One fund per tenant is typical; multiple can exist (e.g. per branch).
    """
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name           = models.CharField(max_length=100, default='Main Petty Cash Fund')
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    custodian      = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='petty_cash_funds'
    )
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} — Balance: KES {self.current_balance:,.2f}"


class PettyCashTransaction(TenantScopedModel):
    """
    A single petty cash request or top-up.
    Requests go through an approval workflow before disbursement.
    """
    TYPE_CHOICES = [
        ('request',  'Disbursement Request'),
        ('topup',    'Fund Top-Up'),
        ('replenish','Replenishment'),
    ]

    STATUS_CHOICES = [
        ('pending',  'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('disbursed','Disbursed'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fund         = models.ForeignKey(PettyCashFund, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='request')
    requested_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='petty_cash_requests'
    )
    amount       = models.DecimalField(max_digits=10, decimal_places=2)
    purpose      = models.CharField(max_length=200)
    category     = models.CharField(max_length=30, blank=True)
    receipt_url  = models.URLField(blank=True)

    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by  = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_petty_cash'
    )
    approval_comment = models.TextField(blank=True)
    approved_at  = models.DateTimeField(null=True, blank=True)
    disbursed_at = models.DateTimeField(null=True, blank=True)

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['fund', 'status'], name='petty_fund_status_idx'),
        ]

    def __str__(self):
        return f"{self.purpose} — KES {self.amount} ({self.status})"

# Re-export books models so Django discovers them under the finance app
from finance.books_models import ChartOfAccount, JournalEntry, JournalLine  # noqa: F401,E402
