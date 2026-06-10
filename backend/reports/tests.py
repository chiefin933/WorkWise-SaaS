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
