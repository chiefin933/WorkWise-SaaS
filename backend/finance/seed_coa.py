"""
finance/seed_coa.py
-------------------
Seeds a standard Kenyan SME Chart of Accounts for a new tenant.
Called automatically when a new Tenant is created.

Account structure follows the standard numbering convention:
  1xxx  Assets
  2xxx  Liabilities
  3xxx  Equity
  4xxx  Revenue
  5xxx  Expenses
"""

from decimal import Decimal


# Standard Kenyan SME Chart of Accounts
STANDARD_ACCOUNTS = [
    # ── ASSETS ───────────────────────────────────────────────────────────────
    # Current Assets
    {'code': '1000', 'name': 'Current Assets',              'type': 'ASSET', 'parent': None},
    {'code': '1100', 'name': 'Cash and Bank',               'type': 'ASSET', 'parent': '1000'},
    {'code': '1101', 'name': 'Petty Cash',                  'type': 'ASSET', 'parent': '1100'},
    {'code': '1102', 'name': 'Bank Account — KCB',          'type': 'ASSET', 'parent': '1100'},
    {'code': '1103', 'name': 'Bank Account — Equity',       'type': 'ASSET', 'parent': '1100'},
    {'code': '1104', 'name': 'M-Pesa Float',                'type': 'ASSET', 'parent': '1100'},
    {'code': '1200', 'name': 'Accounts Receivable',         'type': 'ASSET', 'parent': '1000'},
    {'code': '1300', 'name': 'Prepaid Expenses',            'type': 'ASSET', 'parent': '1000'},
    {'code': '1400', 'name': 'Inventory',                   'type': 'ASSET', 'parent': '1000'},
    {'code': '1500', 'name': 'VAT Recoverable',             'type': 'ASSET', 'parent': '1000'},
    # Non-Current Assets
    {'code': '1600', 'name': 'Non-Current Assets',          'type': 'ASSET', 'parent': None},
    {'code': '1610', 'name': 'Property, Plant & Equipment', 'type': 'ASSET', 'parent': '1600'},
    {'code': '1620', 'name': 'Accumulated Depreciation',    'type': 'ASSET', 'parent': '1600'},
    {'code': '1630', 'name': 'Intangible Assets',           'type': 'ASSET', 'parent': '1600'},

    # ── LIABILITIES ──────────────────────────────────────────────────────────
    # Current Liabilities
    {'code': '2000', 'name': 'Current Liabilities',         'type': 'LIABILITY', 'parent': None},
    {'code': '2100', 'name': 'Accounts Payable',            'type': 'LIABILITY', 'parent': '2000'},
    {'code': '2200', 'name': 'Salaries & Wages Payable',    'type': 'LIABILITY', 'parent': '2000'},
    {'code': '2210', 'name': 'PAYE Payable (KRA)',          'type': 'LIABILITY', 'parent': '2000'},
    {'code': '2220', 'name': 'NSSF Payable',                'type': 'LIABILITY', 'parent': '2000'},
    {'code': '2230', 'name': 'SHIF Payable',                'type': 'LIABILITY', 'parent': '2000'},
    {'code': '2240', 'name': 'Housing Levy Payable (AHL)',  'type': 'LIABILITY', 'parent': '2000'},
    {'code': '2300', 'name': 'VAT Payable',                 'type': 'LIABILITY', 'parent': '2000'},
    {'code': '2400', 'name': 'Short-Term Loans',            'type': 'LIABILITY', 'parent': '2000'},
    {'code': '2500', 'name': 'Accrued Liabilities',         'type': 'LIABILITY', 'parent': '2000'},
    # Non-Current Liabilities
    {'code': '2600', 'name': 'Non-Current Liabilities',     'type': 'LIABILITY', 'parent': None},
    {'code': '2610', 'name': 'Long-Term Loans',             'type': 'LIABILITY', 'parent': '2600'},

    # ── EQUITY ───────────────────────────────────────────────────────────────
    {'code': '3000', 'name': 'Equity',                      'type': 'EQUITY', 'parent': None},
    {'code': '3100', 'name': 'Share Capital',               'type': 'EQUITY', 'parent': '3000'},
    {'code': '3200', 'name': 'Retained Earnings',           'type': 'EQUITY', 'parent': '3000'},
    {'code': '3300', 'name': 'Current Year Profit / Loss',  'type': 'EQUITY', 'parent': '3000'},
    {'code': '3400', 'name': 'Owner Drawings',              'type': 'EQUITY', 'parent': '3000'},

    # ── REVENUE ──────────────────────────────────────────────────────────────
    {'code': '4000', 'name': 'Revenue',                     'type': 'REVENUE', 'parent': None},
    {'code': '4100', 'name': 'Sales Revenue',               'type': 'REVENUE', 'parent': '4000'},
    {'code': '4200', 'name': 'Service Revenue',             'type': 'REVENUE', 'parent': '4000'},
    {'code': '4300', 'name': 'Other Income',                'type': 'REVENUE', 'parent': '4000'},
    {'code': '4310', 'name': 'Interest Income',             'type': 'REVENUE', 'parent': '4300'},
    {'code': '4320', 'name': 'Rental Income',               'type': 'REVENUE', 'parent': '4300'},

    # ── EXPENSES ─────────────────────────────────────────────────────────────
    {'code': '5000', 'name': 'Expenses',                    'type': 'EXPENSE', 'parent': None},
    # Cost of Sales
    {'code': '5100', 'name': 'Cost of Goods Sold',          'type': 'EXPENSE', 'parent': '5000'},
    # Staff Costs
    {'code': '5200', 'name': 'Staff Costs',                 'type': 'EXPENSE', 'parent': '5000'},
    {'code': '5210', 'name': 'Salaries & Wages',            'type': 'EXPENSE', 'parent': '5200'},
    {'code': '5220', 'name': 'NSSF Employer Contribution',  'type': 'EXPENSE', 'parent': '5200'},
    {'code': '5230', 'name': 'SHIF Employer Contribution',  'type': 'EXPENSE', 'parent': '5200'},
    {'code': '5240', 'name': 'Housing Levy — Employer',     'type': 'EXPENSE', 'parent': '5200'},
    {'code': '5250', 'name': 'Staff Training',              'type': 'EXPENSE', 'parent': '5200'},
    # Operating Expenses
    {'code': '5300', 'name': 'Operating Expenses',          'type': 'EXPENSE', 'parent': '5000'},
    {'code': '5310', 'name': 'Rent & Rates',                'type': 'EXPENSE', 'parent': '5300'},
    {'code': '5320', 'name': 'Utilities',                   'type': 'EXPENSE', 'parent': '5300'},
    {'code': '5330', 'name': 'Office Supplies',             'type': 'EXPENSE', 'parent': '5300'},
    {'code': '5340', 'name': 'Travel & Transport',          'type': 'EXPENSE', 'parent': '5300'},
    {'code': '5350', 'name': 'Meals & Entertainment',       'type': 'EXPENSE', 'parent': '5300'},
    {'code': '5360', 'name': 'Telecommunications',          'type': 'EXPENSE', 'parent': '5300'},
    {'code': '5370', 'name': 'Repairs & Maintenance',       'type': 'EXPENSE', 'parent': '5300'},
    {'code': '5380', 'name': 'Insurance',                   'type': 'EXPENSE', 'parent': '5300'},
    {'code': '5390', 'name': 'Advertising & Marketing',     'type': 'EXPENSE', 'parent': '5300'},
    # Financial Expenses
    {'code': '5400', 'name': 'Financial Expenses',          'type': 'EXPENSE', 'parent': '5000'},
    {'code': '5410', 'name': 'Bank Charges',                'type': 'EXPENSE', 'parent': '5400'},
    {'code': '5420', 'name': 'Interest Expense',            'type': 'EXPENSE', 'parent': '5400'},
    {'code': '5430', 'name': 'Depreciation',                'type': 'EXPENSE', 'parent': '5400'},
    # Tax & Statutory
    {'code': '5500', 'name': 'Tax & Statutory',             'type': 'EXPENSE', 'parent': '5000'},
    {'code': '5510', 'name': 'Income Tax Expense',          'type': 'EXPENSE', 'parent': '5500'},
]


def seed_chart_of_accounts(tenant) -> None:
    """
    Create the standard Chart of Accounts for a newly created tenant.
    Safe to call multiple times — uses get_or_create so existing accounts are not duplicated.
    """
    from finance.books_models import ChartOfAccount

    # First pass: create all accounts without parent links
    code_to_obj = {}
    for acct in STANDARD_ACCOUNTS:
        obj, _ = ChartOfAccount.objects.get_or_create(
            tenant=tenant,
            code=acct['code'],
            defaults={
                'name':         acct['name'],
                'account_type': acct['type'],
                'is_system':    True,
                'is_active':    True,
            }
        )
        code_to_obj[acct['code']] = obj

    # Second pass: link parents
    for acct in STANDARD_ACCOUNTS:
        if acct['parent'] and acct['code'] in code_to_obj:
            parent_obj = code_to_obj.get(acct['parent'])
            if parent_obj:
                obj = code_to_obj[acct['code']]
                if obj.parent_id != parent_obj.id:
                    obj.parent = parent_obj
                    obj.save(update_fields=['parent'])
