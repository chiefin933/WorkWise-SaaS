import datetime

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from django.contrib.auth import get_user_model
from tenants.models import Tenant
from employees.models import Employee
from leave.models import Leave

User = get_user_model()


class RBACAndMpesaTests(APITestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name='ACME', plan='GROWTH')

        self.admin_user = User.objects.create_user(
            email='admin@acme.com', password='pass', tenant=self.tenant, role='ADMIN'
        )
        self.hr_user = User.objects.create_user(
            email='hr@acme.com', password='pass', tenant=self.tenant, role='HR'
        )
        self.emp_user = User.objects.create_user(
            email='joe@acme.com', password='pass', tenant=self.tenant, role='EMPLOYEE'
        )

        # Employees
        self.emp = Employee.objects.create(
            tenant=self.tenant, name='Joe', email='joe@acme.com'
        )
        self.other = Employee.objects.create(
            tenant=self.tenant, name='Mary', email='mary@acme.com'
        )

    def test_employee_list_requires_hr_or_admin(self):
        url = reverse('employee-list')

        # Admin can list
        self.client.force_authenticate(user=self.admin_user)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # HR can list
        self.client.force_authenticate(user=self.hr_user)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Regular employee cannot list
        self.client.force_authenticate(user=self.emp_user)
        resp = self.client.get(url)
        self.assertIn(resp.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED))

    def test_employee_cannot_retrieve_another_employee_record(self):
        self.client.force_authenticate(user=self.emp_user)
        resp = self.client.get(reverse('employee-detail', args=[self.other.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_clock_in_restrictions(self):
        url = reverse('attendance-clock-in')

        # Employee can clock themselves
        self.client.force_authenticate(user=self.emp_user)
        resp = self.client.post(url, {'employee': str(self.emp.id)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Employee cannot clock someone else
        resp = self.client.post(url, {'employee': str(self.other.id)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # HR can clock others
        self.client.force_authenticate(user=self.hr_user)
        resp = self.client.post(url, {'employee': str(self.other.id)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_attendance_create_restrictions_apply_to_standard_endpoint(self):
        url = reverse('attendance-list')
        self.client.force_authenticate(user=self.emp_user)

        resp = self.client.post(url, {
            'employee': str(self.other.id),
            'date': '2026-06-10',
            'clock_in': '09:00:00',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        resp = self.client.post(url, {
            'employee': str(self.emp.id),
            'date': '2026-06-10',
            'clock_in': '09:00:00',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_leave_create_and_approve(self):
        url = reverse('leave-list')

        # Employee creating their own leave
        self.client.force_authenticate(user=self.emp_user)
        resp = self.client.post(url, {
            'employee': str(self.emp.id),
            'leave_type': 'annual',
            'start_date': '2026-06-01',
            'end_date': '2026-06-03'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        leave_id = resp.data.get('id')

        # Employee cannot create leave for another
        resp = self.client.post(url, {
            'employee': str(self.other.id),
            'leave_type': 'annual',
            'start_date': '2026-06-01',
            'end_date': '2026-06-03'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # HR can approve
        self.client.force_authenticate(user=self.hr_user)
        approve_url = reverse('leave-approve', args=[leave_id])
        resp = self.client.post(approve_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_reports_restricted_to_hr_admin(self):
        url = reverse('report-generate')
        # Employee should be forbidden
        self.client.force_authenticate(user=self.emp_user)
        resp = self.client.post(url, {'type': 'payroll_summary', 'range': 'this_month'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # HR allowed
        self.client.force_authenticate(user=self.hr_user)
        resp = self.client.post(url, {'type': 'payroll_summary', 'range': 'this_month'}, format='json')
        self.assertIn(resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))

    def test_audit_trail_restricted_to_hr_admin(self):
        url = reverse('audit-trail')

        self.client.force_authenticate(user=self.emp_user)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.hr_user)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    @override_settings(DEBUG=False, MPESA_STK_CALLBACK_URL='')
    def test_mpesa_stk_push_requires_callback_in_production(self):
        url = reverse('stk_push')
        self.client.force_authenticate(user=self.admin_user)
        resp = self.client.post(url, {'phone': '0712345678', 'plan': 'GROWTH', 'amount': '100'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
