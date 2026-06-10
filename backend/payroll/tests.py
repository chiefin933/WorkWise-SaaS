from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from tenants.models import Tenant
from payroll.models import PayrollRun

User = get_user_model()

class BankExportPlanGateTests(APITestCase):
    def setUp(self):
        # Create standard starter tenant
        self.starter_tenant = Tenant.objects.create(
            name="Starter Company",
            plan="STARTER"
        )
        # Create user for starter tenant
        self.starter_user = User.objects.create_user(
            email="starter@company.com",
            password="password123",
            tenant=self.starter_tenant,
            role="ADMIN"
        )
        
        # Create standard growth tenant
        self.growth_tenant = Tenant.objects.create(
            name="Growth Company",
            plan="GROWTH"
        )
        self.growth_user = User.objects.create_user(
            email="growth@company.com",
            password="password123",
            tenant=self.growth_tenant,
            role="ADMIN"
        )
        
        # Create payroll runs
        self.starter_run = PayrollRun.objects.create(
            tenant=self.starter_tenant,
            month=6,
            year=2026,
            status="approved"
        )
        self.growth_run = PayrollRun.objects.create(
            tenant=self.growth_tenant,
            month=6,
            year=2026,
            status="approved"
        )

    def test_starter_plan_bank_export_forbidden(self):
        self.client.force_authenticate(user=self.starter_user)
        url = reverse('payroll-bank-export', kwargs={'pk': self.starter_run.id})
        response = self.client.get(url, {'bank': 'equity'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(response.data.get('upgrade_required'))
        self.assertEqual(response.data.get('required_plan'), 'GROWTH')
        self.assertEqual(response.data.get('current_plan'), 'STARTER')

    def test_growth_plan_bank_export_allowed(self):
        self.client.force_authenticate(user=self.growth_user)
        url = reverse('payroll-bank-export', kwargs={'pk': self.growth_run.id})
        response = self.client.get(url, {'bank': 'equity'})
        # Should not be 403 Forbidden. Note: it might be 400 Bad Request
        # if no bank-transfer employees are configured, but NOT 403.
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)
