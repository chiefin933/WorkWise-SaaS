"""
Tests for statutory CSV export endpoints.

Covers:
  - HTTP status codes and Content-Type
  - CSV structure (headers, row counts)
  - Financial calculations (NSSF tiers, SHIF floor, AHL arithmetic)
  - Plan gating (STARTER blocked, GROWTH/BUSINESS/ENTERPRISE allowed)
  - Tenant isolation (other tenant's run → 404)
  - Authentication (unauthenticated → 401)
  - Edge cases (empty run, invalid export type)
"""
import csv
import io
import re
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APITestCase, APIClient

from employees.models import Employee
from payroll.models import PayrollItem, PayrollRun
from tenants.models import Tenant
from users.models import User


# ── Helper: parse a StreamingHttpResponse CSV ──────────────────────────────────

def parse_csv_response(response):
    """Join streaming_content, decode UTF-8, return list[list[str]]."""
    raw = b''.join(response.streaming_content).decode('utf-8')
    return list(csv.reader(io.StringIO(raw)))


# ── Test class ─────────────────────────────────────────────────────────────────

class StatutoryExportTests(APITestCase):
    """
    End-to-end tests for GET /api/payroll/{run_id}/export/{type}/.
    """

    def setUp(self):
        # ── Tenant (GROWTH — passes plan gate) ─────────────────────────────────
        self.tenant = Tenant.objects.create(name='Test Corp', plan='GROWTH')

        # ── HR user ────────────────────────────────────────────────────────────
        self.user = User.objects.create_user(
            email='hr@testcorp.com',
            tenant=self.tenant,
            role='HR',
        )
        self.client.force_authenticate(user=self.user)

        # ── Payroll run ────────────────────────────────────────────────────────
        self.run = PayrollRun.objects.create(
            tenant=self.tenant,
            month=6,
            year=2025,
            status='processed',
        )

        # ── Employees ──────────────────────────────────────────────────────────
        self.emp1 = Employee.objects.create(
            tenant=self.tenant,
            name='Alice Wanjiru',
            kra_pin='A001234567B',
        )
        self.emp2 = Employee.objects.create(
            tenant=self.tenant,
            name='Bob Kamau',
            kra_pin='',
        )

        # ── PayrollItems ───────────────────────────────────────────────────────
        self.item1 = PayrollItem.objects.create(
            payroll_run=self.run,
            employee=self.emp1,
            gross_salary=Decimal('50000.00'),
            nssf=Decimal('2160.00'),
            shif=Decimal('1375.00'),
            ahl=Decimal('750.00'),
            paye=Decimal('7800.00'),
            net_pay=Decimal('37915.00'),
        )
        self.item2 = PayrollItem.objects.create(
            payroll_run=self.run,
            employee=self.emp2,
            gross_salary=Decimal('25000.00'),
            nssf=Decimal('1500.00'),
            shif=Decimal('687.50'),
            ahl=Decimal('375.00'),
            paye=Decimal('2600.00'),
            net_pay=Decimal('19837.50'),
        )

    def _url(self, export_type, run_id=None):
        run_id = run_id or self.run.id
        return f'/api/payroll/{run_id}/export/{export_type}/'

    # ── Structure tests ────────────────────────────────────────────────────────

    def test_paye_csv_structure(self):
        response = self.client.get(self._url('paye'))

        self.assertEqual(response.status_code, 200)
        self.assertIn('text/csv', response.get('Content-Type', ''))

        rows = parse_csv_response(response)
        self.assertEqual(
            rows[0],
            ['PIN of Employee', 'Employee Name', 'Gross Pay',
             'NSSF', 'SHIF', 'Housing Levy', 'PAYE', 'Net Pay', 'Period'],
        )
        # Header + 2 employees
        self.assertEqual(len(rows), 3)
        # Period column
        self.assertEqual(rows[1][8], '06-2025')
        # Monetary values match \d+\.\d{2}
        monetary_pattern = re.compile(r'^\d+\.\d{2}$')
        for row in rows[1:]:
            for col_idx in (2, 3, 4, 5, 6, 7):
                self.assertRegex(row[col_idx], monetary_pattern,
                                 msg=f"Column {col_idx} in row {row} is not a valid monetary value")

    def test_nssf_csv_structure(self):
        response = self.client.get(self._url('nssf'))
        self.assertEqual(response.status_code, 200)
        rows = parse_csv_response(response)
        self.assertEqual(
            rows[0],
            ['NSSF Number', 'Employee Name', 'PIN', 'Gross Earnings',
             'Tier 1 Contribution', 'Tier 2 Contribution',
             'Total Employee Contribution', 'Employer Contribution', 'Period'],
        )
        self.assertEqual(len(rows[0]), 9)

    def test_shif_csv_structure(self):
        response = self.client.get(self._url('shif'))
        self.assertEqual(response.status_code, 200)
        rows = parse_csv_response(response)
        self.assertEqual(
            rows[0],
            ['Employee Name', 'ID Number (PIN)', 'Gross Salary',
             'SHIF Deduction', 'Month', 'Year'],
        )
        self.assertEqual(len(rows[0]), 6)
        # Month and Year are plain integers
        data_rows = rows[1:]
        for row in data_rows:
            self.assertEqual(row[4], '6')
            self.assertEqual(row[5], '2025')

    def test_ahl_csv_structure(self):
        response = self.client.get(self._url('ahl'))
        self.assertEqual(response.status_code, 200)
        rows = parse_csv_response(response)
        self.assertEqual(
            rows[0],
            ['Employee Name', 'PIN', 'Gross Pay',
             'Employee AHL', 'Employer AHL', 'Total AHL', 'Period'],
        )
        self.assertEqual(len(rows[0]), 7)

    def test_filename_format(self):
        response = self.client.get(self._url('paye'))
        disposition = response.get('Content-Disposition', '')
        expected = f'attachment; filename="paye_{self.run.id}_06-2025.csv"'
        self.assertEqual(disposition, expected)

    # ── Sorting and PIN handling ────────────────────────────────────────────────

    def test_paye_pin_sort_and_empty_pin(self):
        response = self.client.get(self._url('paye'))
        rows = parse_csv_response(response)
        data = rows[1:]  # skip header

        # emp1 has a PIN → must appear first
        self.assertEqual(data[0][0], 'A001234567B')
        self.assertEqual(data[0][1], 'Alice Wanjiru')

        # emp2 has no PIN → appears last, PIN column is empty string
        self.assertEqual(data[1][0], '')
        self.assertEqual(data[1][1], 'Bob Kamau')

    # ── NSSF tier calculation ─────────────────────────────────────────────────

    def test_nssf_tier_calculation(self):
        response = self.client.get(self._url('nssf'))
        rows = parse_csv_response(response)

        # Build a dict: employee name → row
        by_name = {row[1]: row for row in rows[1:]}

        # gross=50000 → Tier1=420.00, Tier2=1740.00, Total=2160.00, Employer=2160.00
        alice = by_name['Alice Wanjiru']
        self.assertEqual(alice[4], '420.00')
        self.assertEqual(alice[5], '1740.00')
        self.assertEqual(alice[6], '2160.00')
        self.assertEqual(alice[7], '2160.00')

        # gross=25000 → Tier1=420.00, Tier2=min((25000-7000)*0.06, 1740)=1080.00, Total=1500.00
        bob = by_name['Bob Kamau']
        self.assertEqual(bob[4], '420.00')
        self.assertEqual(bob[5], '1080.00')
        self.assertEqual(bob[6], '1500.00')

    # ── SHIF floor ────────────────────────────────────────────────────────────

    def test_shif_floor(self):
        """An item with shif=100.00 must export as 300.00 (KES 300 floor)."""
        emp3 = Employee.objects.create(
            tenant=self.tenant, name='Carol Njeri', kra_pin='C009876543D',
        )
        PayrollItem.objects.create(
            payroll_run=self.run,
            employee=emp3,
            gross_salary=Decimal('5000.00'),
            nssf=Decimal('300.00'),
            shif=Decimal('100.00'),   # below floor
            ahl=Decimal('75.00'),
            paye=Decimal('0.00'),
            net_pay=Decimal('4525.00'),
        )

        response = self.client.get(self._url('shif'))
        rows = parse_csv_response(response)
        by_name = {row[0]: row for row in rows[1:]}
        self.assertEqual(by_name['Carol Njeri'][3], '300.00')

    # ── AHL arithmetic ────────────────────────────────────────────────────────

    def test_ahl_arithmetic(self):
        """gross=50000 → Employee AHL=750.00, Employer AHL=750.00, Total=1500.00"""
        response = self.client.get(self._url('ahl'))
        rows = parse_csv_response(response)
        by_name = {row[0]: row for row in rows[1:]}

        alice = by_name['Alice Wanjiru']
        self.assertEqual(alice[3], '750.00')   # Employee AHL
        self.assertEqual(alice[4], '750.00')   # Employer AHL
        self.assertEqual(alice[5], '1500.00')  # Total AHL

    # ── Plan gating ────────────────────────────────────────────────────────────

    def test_permission_denied_starter_plan(self):
        self.tenant.plan = 'STARTER'
        self.tenant.save()
        response = self.client.get(self._url('paye'))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {'error': 'Upgrade your plan to access statutory exports.'},
        )

    def test_permission_denied_growth_allowed(self):
        self.tenant.plan = 'GROWTH'
        self.tenant.save()
        response = self.client.get(self._url('paye'))
        self.assertEqual(response.status_code, 200)

    def test_business_plan_allowed(self):
        self.tenant.plan = 'BUSINESS'
        self.tenant.save()
        response = self.client.get(self._url('paye'))
        self.assertEqual(response.status_code, 200)

    def test_enterprise_plan_allowed(self):
        self.tenant.plan = 'ENTERPRISE'
        self.tenant.save()
        response = self.client.get(self._url('paye'))
        self.assertEqual(response.status_code, 200)

    # ── Authentication ────────────────────────────────────────────────────────

    def test_unauthenticated_returns_401(self):
        unauth_client = APIClient()
        response = unauth_client.get(self._url('paye'))
        self.assertEqual(response.status_code, 401)

    # ── Tenant isolation ──────────────────────────────────────────────────────

    def test_wrong_tenant_returns_404(self):
        """Calling with tenant1 credentials but tenant2's run ID → 404."""
        tenant2 = Tenant.objects.create(name='Other Corp', plan='GROWTH')
        run2 = PayrollRun.objects.create(
            tenant=tenant2, month=6, year=2025, status='processed',
        )
        response = self.client.get(self._url('paye', run_id=run2.id))
        self.assertEqual(response.status_code, 404)

    # ── Empty run ─────────────────────────────────────────────────────────────

    def test_empty_payroll_run(self):
        """A run with no items should return HTTP 200 with exactly 1 row (header only)."""
        PayrollItem.objects.filter(payroll_run=self.run).delete()

        for export_type in ('paye', 'nssf', 'shif', 'ahl'):
            with self.subTest(export_type=export_type):
                response = self.client.get(self._url(export_type))
                self.assertEqual(response.status_code, 200)
                rows = parse_csv_response(response)
                self.assertEqual(
                    len(rows), 1,
                    msg=f"{export_type}: expected 1 header row, got {len(rows)}",
                )

    # ── Invalid export type ───────────────────────────────────────────────────

    def test_invalid_export_type(self):
        response = self.client.get(self._url('invalid'))
        self.assertEqual(response.status_code, 400)
