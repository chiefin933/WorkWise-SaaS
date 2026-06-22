"""
finance/auto_post.py
--------------------
Automatically posts journal entries to the books when:
  1. A PayrollRun is approved  → debit Salaries Expense, credit statutory payables + bank
  2. An ExpenseClaim is paid   → debit the expense account, credit bank
  3. A PettyCash disbursement  → debit expense account, credit Petty Cash asset

Called from Django signals in finance/signals.py.
All amounts are in KES.
"""

import logging
from decimal import Decimal
from django.db import transaction

logger = logging.getLogger(__name__)

# Account codes used for auto-posting
ACCOUNT_CODES = {
    'salaries':       '5210',  # Salaries & Wages
    'paye_payable':   '2210',  # PAYE Payable (KRA)
    'nssf_payable':   '2220',  # NSSF Payable
    'shif_payable':   '2230',  # SHIF Payable
    'ahl_payable':    '2240',  # Housing Levy Payable
    'bank':           '1102',  # Bank Account (default)
    'petty_cash':     '1101',  # Petty Cash asset
    # Expense category → account code mapping
    'travel':         '5340',
    'accommodation':  '5340',
    'meals':          '5350',
    'office':         '5330',
    'client':         '5350',
    'utilities':      '5320',
    'training':       '5250',
    'medical':        '5300',
    'other':          '5300',
}


def _get_account(tenant, code):
    from finance.books_models import ChartOfAccount
    try:
        return ChartOfAccount.objects.get(tenant=tenant, code=code, is_active=True)
    except ChartOfAccount.DoesNotExist:
        logger.warning("Auto-post: Account %s not found for tenant %s — seeding COA", code, tenant.name)
        from finance.seed_coa import seed_chart_of_accounts
        seed_chart_of_accounts(tenant)
        return ChartOfAccount.objects.get(tenant=tenant, code=code, is_active=True)


def post_payroll_to_books(payroll_run) -> None:
    """
    On payroll approval, post:
      DR  5210  Salaries & Wages          (gross total)
      CR  2210  PAYE Payable              (total PAYE)
      CR  2220  NSSF Payable              (total NSSF)
      CR  2230  SHIF Payable              (total SHIF)
      CR  2240  Housing Levy Payable      (total AHL)
      CR  1102  Bank                      (total net pay)
    """
    from finance.books_models import JournalEntry, JournalLine

    tenant = payroll_run.tenant
    items  = payroll_run.items.all()

    if not items.exists():
        return

    gross  = sum(Decimal(str(i.gross_salary)) for i in items)
    paye   = sum(Decimal(str(i.paye))         for i in items)
    nssf   = sum(Decimal(str(i.nssf))         for i in items)
    shif   = sum(Decimal(str(i.shif))         for i in items)
    ahl    = sum(Decimal(str(i.ahl))           for i in items)
    net    = sum(Decimal(str(i.net_pay))       for i in items)

    import calendar
    month_name = calendar.month_name[payroll_run.month]

    try:
        with transaction.atomic():
            entry = JournalEntry.objects.create(
                tenant=tenant,
                date=payroll_run.updated_at.date() if hasattr(payroll_run, 'updated_at') else __import__('django.utils.timezone', fromlist=['now']).now().date(),
                reference=f"PR-{payroll_run.year}-{payroll_run.month:02d}",
                description=f"{month_name} {payroll_run.year} Payroll — {items.count()} employees",
                source='PAYROLL',
                status='DRAFT',
            )

            lines = [
                (_get_account(tenant, ACCOUNT_CODES['salaries']),    'DEBIT',  gross,  'Gross salaries'),
                (_get_account(tenant, ACCOUNT_CODES['paye_payable']), 'CREDIT', paye,   'PAYE payable to KRA'),
                (_get_account(tenant, ACCOUNT_CODES['nssf_payable']), 'CREDIT', nssf,   'NSSF contributions payable'),
                (_get_account(tenant, ACCOUNT_CODES['shif_payable']), 'CREDIT', shif,   'SHIF contributions payable'),
                (_get_account(tenant, ACCOUNT_CODES['ahl_payable']),  'CREDIT', ahl,    'Housing Levy payable'),
                (_get_account(tenant, ACCOUNT_CODES['bank']),         'CREDIT', net,    'Net salaries paid via bank/M-Pesa'),
            ]

            for account, side, amount, desc in lines:
                if amount > 0:
                    JournalLine.objects.create(
                        entry=entry, account=account,
                        side=side, amount=amount, description=desc,
                    )

            entry.post()
            logger.info("Auto-posted payroll JE %s for %s", entry.reference, tenant.name)

    except Exception as exc:
        logger.error("Failed to auto-post payroll to books: %s", exc, exc_info=True)


def post_expense_to_books(expense_claim) -> None:
    """
    On expense claim marked as paid:
      DR  5xxx  Expense account (based on category)
      CR  1102  Bank
    """
    from finance.books_models import JournalEntry, JournalLine

    tenant = expense_claim.tenant
    amount = Decimal(str(expense_claim.amount))
    cat    = expense_claim.category
    acct_code = ACCOUNT_CODES.get(cat, '5300')

    try:
        with transaction.atomic():
            entry = JournalEntry.objects.create(
                tenant=tenant,
                date=expense_claim.paid_at.date() if expense_claim.paid_at else __import__('django.utils.timezone', fromlist=['now']).now().date(),
                reference=f"EXP-{str(expense_claim.id)[:8].upper()}",
                description=f"Expense: {expense_claim.title} — {expense_claim.employee_name if hasattr(expense_claim, 'employee_name') else expense_claim.employee.name}",
                source='EXPENSE',
                status='DRAFT',
            )
            JournalLine.objects.create(
                entry=entry,
                account=_get_account(tenant, acct_code),
                side='DEBIT', amount=amount,
                description=expense_claim.title,
            )
            JournalLine.objects.create(
                entry=entry,
                account=_get_account(tenant, ACCOUNT_CODES['bank']),
                side='CREDIT', amount=amount,
                description=f"Payment for {expense_claim.title}",
            )
            entry.post()
            logger.info("Auto-posted expense JE %s for %s", entry.reference, tenant.name)

    except Exception as exc:
        logger.error("Failed to auto-post expense to books: %s", exc, exc_info=True)


def post_petty_cash_to_books(txn) -> None:
    """
    On petty cash disbursement:
      DR  5300  Operating Expense
      CR  1101  Petty Cash
    """
    from finance.books_models import JournalEntry, JournalLine

    tenant = txn.tenant
    amount = Decimal(str(txn.amount))

    try:
        with transaction.atomic():
            entry = JournalEntry.objects.create(
                tenant=tenant,
                date=txn.disbursed_at.date() if txn.disbursed_at else __import__('django.utils.timezone', fromlist=['now']).now().date(),
                reference=f"PC-{str(txn.id)[:8].upper()}",
                description=f"Petty Cash: {txn.purpose}",
                source='PETTY',
                status='DRAFT',
            )
            exp_code = ACCOUNT_CODES.get(txn.category, '5300') if txn.category else '5300'
            JournalLine.objects.create(
                entry=entry,
                account=_get_account(tenant, exp_code),
                side='DEBIT', amount=amount,
                description=txn.purpose,
            )
            JournalLine.objects.create(
                entry=entry,
                account=_get_account(tenant, ACCOUNT_CODES['petty_cash']),
                side='CREDIT', amount=amount,
                description=f"Petty cash disbursement: {txn.purpose}",
            )
            entry.post()
            logger.info("Auto-posted petty cash JE %s for %s", entry.reference, tenant.name)

    except Exception as exc:
        logger.error("Failed to auto-post petty cash to books: %s", exc, exc_info=True)
