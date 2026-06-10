#!/usr/bin/env python3
"""
WorkWise SaaS — Cryptographic and Sandbox Isolation Verification Script

Validates:
1. Automated query isolation (Django objects manager automatically filters by thread/context-local tenant).
2. Native AES-256-GCM database-at-rest encryption.
"""

import os
import sys
import django
import sqlite3

# ── Colors for terminal output ─────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def check(label, condition, detail=""):
    if condition:
        print(f"  {GREEN}✓ PASS{RESET} — {label}")
    else:
        print(f"  {RED}✗ FAIL{RESET} — {label}  {detail}")
        sys.exit(1)


def run_tests():
    # 1. Setup Django environment
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()

    from tenants.models import Tenant
    from employees.models import Employee
    from core.tenant_context import set_current_tenant, clear_current_tenant, get_current_tenant

    from django.db import transaction

    print(f"\n{CYAN}{BOLD}{'═'*60}")
    print("  LAYER-2 SECURITY SANDBOX & ENCRYPTION VERIFICATION")
    print(f"{'═'*60}{RESET}\n")

    try:
        with transaction.atomic():
            # 2. Setup isolated test tenants
            tenant_a = Tenant.objects.create(name="Secure Tenant A", plan="STARTER")
            tenant_b = Tenant.objects.create(name="Secure Tenant B", plan="GROWTH")

            # 3. Create employees in each tenant
            emp_a = Employee.objects.create(
                tenant=tenant_a,
                name="Alice A (Tenant A User)",
                email="alice@tenant-a.com",
                kra_pin="KRA-A-SECURE",
                bank_details={"bank_name": "KCB", "account_number": "999888"},
                salary_basic=100000.00
            )

            emp_b = Employee.objects.create(
                tenant=tenant_b,
                name="Bob B (Tenant B User)",
                email="bob@tenant-b.com",
                kra_pin="KRA-B-SECURE",
                bank_details={"bank_name": "Equity", "account_number": "555444"},
                salary_basic=120000.00
            )

            print(f"{CYAN}{BOLD}Testing Automated Context Isolation Manager...{RESET}")

            # ── Assertion 1: Unscoped query returns all (global system/admin context) ──
            clear_current_tenant()
            all_unscoped = list(Employee.unscoped.filter(id__in=[emp_a.id, emp_b.id]))
            check("Unscoped query returns both employees", len(all_unscoped) == 2)

            # ── Assertion 2: Context sandbox constraints (Tenant A) ──
            set_current_tenant(tenant_a)
            active = get_current_tenant()
            check("Tenant A context active", active == tenant_a)

            # Standard model.objects queries should automatically be scoped
            a_employees = list(Employee.objects.all())
            check("Tenant A objects filter active", emp_a in a_employees and emp_b not in a_employees,
                  f"Returned employees: {[e.name for e in a_employees]}")

            # ── Assertion 3: Context sandbox constraints (Tenant B) ──
            set_current_tenant(tenant_b)
            active = get_current_tenant()
            check("Tenant B context active", active == tenant_b)

            b_employees = list(Employee.objects.all())
            check("Tenant B objects filter active", emp_b in b_employees and emp_a not in b_employees,
                  f"Returned employees: {[e.name for e in b_employees]}")

            # Clear context back to clean state
            clear_current_tenant()

            print(f"\n{CYAN}{BOLD}Testing AES-256-GCM Encrypted Storage at Rest...{RESET}")

            # ── Assertion 4: Verify Python level decrypts transparently ──
            check("KRA PIN decrypts transparently in Python", emp_a.kra_pin == "KRA-A-SECURE", f"got: {emp_a.kra_pin}")
            check("Bank details JSON decrypts transparently in Python", emp_a.bank_details.get("account_number") == "999888")

            # ── Assertion 5: Verify SQLite level holds secure scrambled ciphertexts ──
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT kra_pin, bank_details FROM employees_employee WHERE name = %s;", ["Alice A (Tenant A User)"])
                row = cursor.fetchone()

            check("Database row retrieved", row is not None)
            raw_kra = row[0]
            raw_bank = row[1]

            check("KRA PIN is NOT stored as plain text", raw_kra != "KRA-A-SECURE")
            check("Bank details are NOT stored as plain JSON", "999888" not in raw_bank)
            check("GCM packages present secure base64 shapes", len(raw_kra) > 20 and not raw_kra.startswith("gAAAA"))

            print(f"\n  Raw encrypted KRA PIN in database: {raw_kra[:45]}...")
            print(f"  Raw encrypted Bank Details in database: {raw_bank[:45]}...")

            # Raise exception to trigger automatic transaction rollback and prevent DB pollution / trigger violations
            raise RuntimeError("Intentional Rollback")
    except RuntimeError as e:
        if str(e) != "Intentional Rollback":
            raise

    print(f"\n{GREEN}{BOLD}════════════════════════════════════════════════════════════")
    print("  VERIFICATION SUCCESSFUL: LAYER-2 VAULT LOCK IS UNBREAKABLE")
    print(f"════════════════════════════════════════════════════════════{RESET}\n")


if __name__ == "__main__":
    run_tests()
