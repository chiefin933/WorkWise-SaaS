"""
finance/books_models.py
-----------------------
Double-entry bookkeeping models for WorkWise Finance.

Accounting equation enforced: Assets = Liabilities + Equity
Every journal entry must balance: Total Debits == Total Credits

Account numbering convention (standard Kenyan SME):
  1xxx  Assets
  2xxx  Liabilities
  3xxx  Equity
  4xxx  Revenue
  5xxx  Expenses
"""

import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from core.tenant_models import TenantScopedModel


# ── Account Types ─────────────────────────────────────────────────────────────

ACCOUNT_TYPE_CHOICES = [
    ('ASSET',     'Asset'),
    ('LIABILITY', 'Liability'),
    ('EQUITY',    'Equity'),
    ('REVENUE',   'Revenue'),
    ('EXPENSE',   'Expense'),
]

# Normal balance: DEBIT increases Assets & Expenses; CREDIT increases Liabilities, Equity, Revenue
DEBIT_NORMAL  = {'ASSET', 'EXPENSE'}
CREDIT_NORMAL = {'LIABILITY', 'EQUITY', 'REVENUE'}


class ChartOfAccount(TenantScopedModel):
    """
    A single account in the Chart of Accounts.
    Pre-seeded with a standard Kenyan SME set on tenant creation.
    Finance managers can add, rename, or deactivate accounts.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code         = models.CharField(max_length=20)          # e.g. "1100", "4000"
    name         = models.CharField(max_length=150)         # e.g. "Cash and Bank"
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES)
    parent       = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='sub_accounts'
    )
    description  = models.TextField(blank=True)
    is_active    = models.BooleanField(default=True)
    is_system    = models.BooleanField(default=False)   # True = seeded, cannot be deleted
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['code']
        indexes  = [
            models.Index(fields=['account_type'], name='coa_type_idx'),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"

    @property
    def normal_balance(self) -> str:
        return 'DEBIT' if self.account_type in DEBIT_NORMAL else 'CREDIT'

    def running_balance(self) -> Decimal:
        """Compute current balance from all posted journal lines."""
        from django.db.models import Sum
        lines = JournalLine.objects.filter(
            account=self,
            entry__status='POSTED'
        )
        debits  = lines.filter(side='DEBIT').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        credits = lines.filter(side='CREDIT').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        if self.account_type in DEBIT_NORMAL:
            return debits - credits
        return credits - debits


# ── Journal Entry ─────────────────────────────────────────────────────────────

class JournalEntry(TenantScopedModel):
    """
    A double-entry journal entry. Must have at least 2 lines and
    total debits == total credits before it can be posted.

    Sources:
      MANUAL   — entered directly by Finance Manager
      PAYROLL  — auto-posted when a payroll run is approved
      EXPENSE  — auto-posted when an expense claim is marked paid
      PETTY    — auto-posted when a petty cash disbursement is approved
    """
    SOURCE_CHOICES = [
        ('MANUAL',  'Manual Entry'),
        ('PAYROLL', 'Payroll Run'),
        ('EXPENSE', 'Expense Claim'),
        ('PETTY',   'Petty Cash'),
    ]
    STATUS_CHOICES = [
        ('DRAFT',    'Draft'),
        ('POSTED',   'Posted'),
        ('REVERSED', 'Reversed'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date         = models.DateField(default=timezone.now)
    reference    = models.CharField(max_length=100, blank=True)  # e.g. "PR-2026-06", "EXP-001"
    description  = models.TextField()
    source       = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='MANUAL')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    created_by   = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='journal_entries'
    )
    reversed_by  = models.OneToOneField(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reversal_of'
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']
        indexes  = [
            models.Index(fields=['date'],   name='je_date_idx'),
            models.Index(fields=['source'], name='je_source_idx'),
            models.Index(fields=['status'], name='je_status_idx'),
        ]

    def __str__(self):
        return f"JE-{str(self.id)[:8]} | {self.date} | {self.description[:50]}"

    def total_debits(self) -> Decimal:
        return self.lines.filter(side='DEBIT').aggregate(
            t=models.Sum('amount')
        )['t'] or Decimal('0')

    def total_credits(self) -> Decimal:
        return self.lines.filter(side='CREDIT').aggregate(
            t=models.Sum('amount')
        )['t'] or Decimal('0')

    def is_balanced(self) -> bool:
        return self.total_debits() == self.total_credits()

    def post(self):
        """Validate and post the entry. Raises ValueError if not balanced."""
        if self.status == 'POSTED':
            raise ValueError("Entry is already posted.")
        if not self.lines.exists():
            raise ValueError("Cannot post an entry with no lines.")
        if not self.is_balanced():
            raise ValueError(
                f"Entry is not balanced: Debits {self.total_debits()} ≠ Credits {self.total_credits()}"
            )
        self.status = 'POSTED'
        self.save(update_fields=['status', 'updated_at'])

    def reverse(self, created_by=None, description: str = '') -> 'JournalEntry':
        """Create a reversing entry with all debit/credit sides swapped."""
        if self.status != 'POSTED':
            raise ValueError("Only posted entries can be reversed.")
        reversal = JournalEntry.objects.create(
            tenant=self.tenant,
            date=timezone.now().date(),
            reference=f"REV-{self.reference or str(self.id)[:8]}",
            description=description or f"Reversal of: {self.description}",
            source=self.source,
            status='DRAFT',
            created_by=created_by,
        )
        for line in self.lines.all():
            JournalLine.objects.create(
                entry=reversal,
                account=line.account,
                side='CREDIT' if line.side == 'DEBIT' else 'DEBIT',
                amount=line.amount,
                description=line.description,
            )
        reversal.post()
        self.reversed_by = reversal
        self.status = 'REVERSED'
        self.save(update_fields=['reversed_by', 'status', 'updated_at'])
        return reversal


class JournalLine(models.Model):
    """
    One line (leg) of a journal entry.
    side = DEBIT | CREDIT
    """
    SIDE_CHOICES = [('DEBIT', 'Debit'), ('CREDIT', 'Credit')]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry       = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account     = models.ForeignKey(ChartOfAccount, on_delete=models.PROTECT, related_name='journal_lines')
    side        = models.CharField(max_length=6, choices=SIDE_CHOICES)
    amount      = models.DecimalField(max_digits=14, decimal_places=2)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['side', 'account__code']

    def __str__(self):
        return f"{self.side} {self.account.code} {self.amount}"
