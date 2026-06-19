from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

from tenants.models import Tenant
from employees.models import Employee
from payroll.models import PayrollRun, PayrollItem

User = get_user_model()

class PayslipTests(APITestCase):
    def setUp(self):
        # Create Tenant A and Tenant B
        self.tenant_a = Tenant.objects.create(name="Acme Corp A", plan="STARTER")
        self.tenant_b = Tenant.objects.create(name="Acme Corp B", plan="STARTER")
        
        # Create Employees
        self.employee_alice = Employee.objects.create(
            tenant=self.tenant_a,
            name="Alice Employee",
            email="alice@acme.com",
            status="active",
            salary_basic="50000.00"
        )
        self.employee_bob = Employee.objects.create(
            tenant=self.tenant_b,
            name="Bob Employee",
            email="bob@acme.com",
            status="active",
            salary_basic="60000.00"
        )
        self.employee_charlie = Employee.objects.create(
            tenant=self.tenant_a,
            name="Charlie Employee",
            email="charlie@acme.com",
            status="active",
            salary_basic="45000.00"
        )
        
        # Create Users
        self.user_alice = User.objects.create_user(
            email="alice@acme.com",
            password="password123",
            tenant=self.tenant_a,
            role="EMPLOYEE"
        )
        self.user_bob = User.objects.create_user(
            email="bob@acme.com",
            password="password123",
            tenant=self.tenant_b,
            role="EMPLOYEE"
        )
        self.user_charlie = User.objects.create_user(
            email="charlie@acme.com",
            password="password123",
            tenant=self.tenant_a,
            role="EMPLOYEE"
        )
        self.user_hr_a = User.objects.create_user(
            email="hr@acme.com",
            password="password123",
            tenant=self.tenant_a,
            role="HR"
        )
        
        # Create Payroll Runs
        self.run_a = PayrollRun.objects.create(tenant=self.tenant_a, month=6, year=2026, status="approved")
        self.run_b = PayrollRun.objects.create(tenant=self.tenant_b, month=6, year=2026, status="approved")
        
        # Create Payroll Items
        self.item_alice = PayrollItem.objects.create(
            payroll_run=self.run_a,
            employee=self.employee_alice,
            gross_salary=50000.00,
            net_pay=38000.00
        )
        self.item_bob = PayrollItem.objects.create(
            payroll_run=self.run_b,
            employee=self.employee_bob,
            gross_salary=60000.00,
            net_pay=45000.00
        )
        
    def test_download_payslip_self_success(self):
        self.client.force_authenticate(user=self.user_alice)
        url = reverse('payslip-download', args=[self.item_alice.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn('payslip_alice_employee', response['Content-Disposition'])

    def test_download_payslip_hr_success(self):
        self.client.force_authenticate(user=self.user_hr_a)
        url = reverse('payslip-download', args=[self.item_alice.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')

    def test_download_payslip_unauthorized_other_employee(self):
        # Charlie tries to download Alice's payslip
        self.client.force_authenticate(user=self.user_charlie)
        url = reverse('payslip-download', args=[self.item_alice.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['error'], 'You do not have permission to access this payslip.')

    def test_download_payslip_tenant_isolation(self):
        # Bob (Tenant B) tries to access Alice's (Tenant A) payslip
        self.client.force_authenticate(user=self.user_bob)
        url = reverse('payslip-download', args=[self.item_alice.id])
        response = self.client.get(url)
        
        # Should return 404 because query filters by tenant of the user (tenant_b)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error'], 'Payroll record not found or access denied')

    def test_download_payslip_not_found(self):
        self.client.force_authenticate(user=self.user_alice)
        import uuid
        random_uuid = uuid.uuid4()
        url = reverse('payslip-download', args=[random_uuid])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
