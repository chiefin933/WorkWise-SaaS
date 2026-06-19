import datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from tenants.models import Tenant
from employees.models import Employee
from payroll.models import PayrollRun, PayrollItem

User = get_user_model()


class ReportRangeTests(APITestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name='Report Company', plan='GROWTH')
        self.user = User.objects.create_user(
            email='admin@report.com',
            password='password123',
            tenant=self.tenant,
            role='ADMIN'
        )
        self.employee = Employee.objects.create(
            tenant=self.tenant,
            name='Report Employee',
            email='employee@report.com',
            payment_method='mpesa',
            mpesa_number='254712345678',
            salary_basic=50000.00,
        )

        self.june_2026 = PayrollRun.objects.create(
            tenant=self.tenant,
            month=6,
            year=2026,
            status='approved'
        )
        self.may_2026 = PayrollRun.objects.create(
            tenant=self.tenant,
            month=5,
            year=2026,
            status='approved'
        )
        self.april_2026 = PayrollRun.objects.create(
            tenant=self.tenant,
            month=4,
            year=2026,
            status='approved'
        )
        self.june_2025 = PayrollRun.objects.create(
            tenant=self.tenant,
            month=6,
            year=2025,
            status='approved'
        )

        for payroll_run in [self.june_2026, self.may_2026, self.april_2026, self.june_2025]:
            PayrollItem.objects.create(
                payroll_run=payroll_run,
                employee=self.employee,
                gross_salary=50000.00,
                paye=5000.00,
                nssf=2000.00,
                shif=750.00,
                ahl=750.00,
                net_pay=42500.00,
            )

    @patch('reports.views.timezone.now')
    def test_supported_ranges_return_report(self, mock_now):
        mock_now.return_value = datetime.datetime(2026, 6, 15, tzinfo=datetime.timezone.utc)
        self.client.force_authenticate(user=self.user)

        ranges = {
            'last_30_days': 2,
            'current_quarter': 3,
            'last_12_months': 4,
            'all_time': 4,
            'this_month': 1,
            'last_month': 1,
            'this_year': 3,
            '2026-05': 1,
        }

        url = reverse('report-generate')
        for range_value, expected_rows in ranges.items():
            with self.subTest(range=range_value):
                response = self.client.post(url, {
                    'type': 'payroll_summary',
                    'range': range_value,
                }, format='json')

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertIn('Content-Disposition', response)
                content = response.content.decode('utf-8').strip().splitlines()
                self.assertEqual(len(content), expected_rows + 1)

    @patch('reports.views.timezone.now')
    def test_unsupported_range_returns_400(self, mock_now):
        mock_now.return_value = datetime.datetime(2026, 6, 15, tzinfo=datetime.timezone.utc)
        self.client.force_authenticate(user=self.user)

        url = reverse('report-generate')
        response = self.client.post(url, {
            'type': 'payroll_summary',
            'range': 'unsupported_range',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Unsupported range value', response.data.get('error', ''))


class StatutoryExportTests(APITestCase):
    """
    Tests for the three new statutory export endpoints:
      - /reports/p10-monthly/   → P10MonthlyView
      - /reports/nssf-schedule/ → NSSFScheduleView
      - /reports/shif-schedule/ → SHIFScheduleView
    """

    def setUp(self):
        self.tenant = Tenant.objects.create(name='Statutory Co', plan='GROWTH')
        self.admin = User.objects.create_user(
            email='admin@statutory.com',
            password='pass1234',
            tenant=self.tenant,
            role='ADMIN',
        )
        self.employee = Employee.objects.create(
            tenant=self.tenant,
            name='Jane Doe',
            email='jane@statutory.com',
            salary_basic=80000.00,
            allowances={'house': 10000, 'transport': 5000},
            kra_pin='A001234567X',
        )
        # A processed payroll run for June 2026
        self.run = PayrollRun.objects.create(
            tenant=self.tenant,
            month=6,
            year=2026,
            status='processed',
        )
        self.item = PayrollItem.objects.create(
            payroll_run=self.run,
            employee=self.employee,
            gross_salary=95000.00,
            paye=18000.00,
            nssf=4320.00,
            shif=2612.50,
            ahl=1425.00,
            net_pay=68642.50,
        )

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _csv_rows(self, response):
        """Decode CSV response into a list of rows (split by newline)."""
        return [r for r in response.content.decode('utf-8').strip().splitlines() if r.strip()]

    # ── Authentication guard ────────────────────────────────────────────────────

    def test_p10_requires_auth(self):
        url = reverse('report-p10-monthly')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_nssf_requires_auth(self):
        url = reverse('report-nssf-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_shif_requires_auth(self):
        url = reverse('report-shif-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── P10 Monthly ─────────────────────────────────────────────────────────────

    def test_p10_returns_csv_with_correct_headers(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-p10-monthly')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', response['Content-Type'])
        # Header row + 1 employee row
        rows = self._csv_rows(response)
        self.assertEqual(len(rows), 2)
        self.assertIn('Employee PIN', rows[0])
        self.assertIn('Net PAYE Payable', rows[0])

    def test_p10_data_row_contains_employee_kra_pin(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-p10-monthly')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        rows = self._csv_rows(response)
        # data row is index 1
        self.assertIn('A001234567X', rows[1])

    def test_p10_empty_month_returns_header_only(self):
        """When there is no processed payroll, only the CSV header is returned."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-p10-monthly')
        # January 2026 has no payroll run
        response = self.client.get(url, {'month': 1, 'year': 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = self._csv_rows(response)
        self.assertEqual(len(rows), 1)  # header only

    def test_p10_filename_includes_period(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-p10-monthly')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertIn('p10_paye_2026_06', response['Content-Disposition'])

    def test_p10_draft_run_excluded(self):
        """Items from draft payroll runs must NOT appear in the P10 export."""
        draft_run = PayrollRun.objects.create(
            tenant=self.tenant, month=7, year=2026, status='draft'
        )
        PayrollItem.objects.create(
            payroll_run=draft_run, employee=self.employee,
            gross_salary=95000, paye=18000, nssf=4320,
            shif=2612, ahl=1425, net_pay=68643,
        )
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-p10-monthly')
        response = self.client.get(url, {'month': 7, 'year': 2026})
        rows = self._csv_rows(response)
        # draft → header only
        self.assertEqual(len(rows), 1)

    def test_p10_tenant_isolation(self):
        """A second tenant's admin cannot see the first tenant's P10 data."""
        other_tenant = Tenant.objects.create(name='Other Co', plan='GROWTH')
        other_admin = User.objects.create_user(
            email='admin@other.com', password='pass1234',
            tenant=other_tenant, role='ADMIN',
        )
        self.client.force_authenticate(user=other_admin)
        url = reverse('report-p10-monthly')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        rows = self._csv_rows(response)
        # other tenant has no payroll → header only
        self.assertEqual(len(rows), 1)

    # ── NSSF Schedule ───────────────────────────────────────────────────────────

    def test_nssf_returns_csv(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-nssf-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', response['Content-Type'])

    def test_nssf_has_employee_row_and_totals(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-nssf-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        rows = self._csv_rows(response)
        # header + 1 employee + totals row = 3 non-empty lines
        self.assertEqual(len(rows), 3)

    def test_nssf_totals_row_contains_amounts(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-nssf-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        rows = self._csv_rows(response)
        totals_row = rows[-1]
        self.assertIn('TOTALS', totals_row)
        # total NSSF: 4320 employee + 4320 employer = 8640
        self.assertIn('8640', totals_row)

    def test_nssf_filename_includes_period(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-nssf-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertIn('nssf_schedule_2026_06', response['Content-Disposition'])

    # ── SHIF / AHL Schedule ─────────────────────────────────────────────────────

    def test_shif_returns_csv(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-shif-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', response['Content-Type'])

    def test_shif_has_employee_row_and_totals(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-shif-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        rows = self._csv_rows(response)
        # header + 1 employee + totals row = 3 non-empty lines
        self.assertEqual(len(rows), 3)

    def test_shif_totals_correct(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-shif-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        rows = self._csv_rows(response)
        totals_row = rows[-1]
        self.assertIn('TOTALS', totals_row)
        # SHIF = 2612.5, AHL = 1425 → total SHA = 4037.5
        self.assertIn('4037.5', totals_row)

    def test_shif_filename_includes_period(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-shif-schedule')
        response = self.client.get(url, {'month': 6, 'year': 2026})
        self.assertIn('shif_schedule_2026_06', response['Content-Disposition'])

    def test_shif_empty_month_returns_header_and_totals_only(self):
        """Empty month returns header + totals rows (2 lines) with zero amounts."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('report-shif-schedule')
        response = self.client.get(url, {'month': 1, 'year': 2026})
        rows = self._csv_rows(response)
        # header + totals = 2
        self.assertEqual(len(rows), 2)
        self.assertIn('0.0', rows[-1])
