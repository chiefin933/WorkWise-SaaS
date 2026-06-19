import datetime
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

from tenants.models import Tenant
from employees.models import Employee
from leave.models import Leave

User = get_user_model()

class LeaveTests(APITestCase):
    def setUp(self):
        # Create tenant
        self.tenant = Tenant.objects.create(name="Acme Corp", plan="STARTER")
        
        # Create employees
        self.employee1 = Employee.objects.create(
            tenant=self.tenant,
            name="Alice Employee",
            email="alice@acme.com",
            status="active"
        )
        self.employee2 = Employee.objects.create(
            tenant=self.tenant,
            name="Bob Employee",
            email="bob@acme.com",
            status="active"
        )
        
        # Create users
        self.user_emp1 = User.objects.create_user(
            email="alice@acme.com",
            password="password123",
            tenant=self.tenant,
            role="EMPLOYEE"
        )
        self.user_emp2 = User.objects.create_user(
            email="bob@acme.com",
            password="password123",
            tenant=self.tenant,
            role="EMPLOYEE"
        )
        self.user_hr = User.objects.create_user(
            email="hr@acme.com",
            password="password123",
            tenant=self.tenant,
            role="HR"
        )
        
        self.list_url = reverse('leave-list')
        self.balance_url = reverse('leave-my-balance')

    def test_employee_can_request_leave_for_self(self):
        self.client.force_authenticate(user=self.user_emp1)
        payload = {
            "employee": self.employee1.id,
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "reason": "Rest and relaxation"
        }
        
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Leave.objects.filter(employee=self.employee1).count(), 1)
        
        leave = Leave.objects.get(employee=self.employee1)
        self.assertEqual(leave.status, 'pending')
        self.assertEqual(leave.leave_type, 'annual')

    def test_employee_cannot_request_leave_for_others(self):
        # Alice tries to request leave for Bob
        self.client.force_authenticate(user=self.user_emp1)
        payload = {
            "employee": self.employee2.id,
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "reason": "Bob's vacation"
        }
        
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_leave_date_order_validation(self):
        self.client.force_authenticate(user=self.user_emp1)
        # End date before start date
        payload = {
            "employee": self.employee1.id,
            "leave_type": "annual",
            "start_date": "2026-07-10",
            "end_date": "2026-07-05",
        }
        
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Start date must be before or equal to end date.", str(response.data))

    def test_leave_policy_limits_exceeded(self):
        self.client.force_authenticate(user=self.user_emp1)
        
        # Annual leave policy limit is 21 days. Requesting 22 days should fail.
        payload = {
            "employee": self.employee1.id,
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-22", # 22 days
        }
        
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds remaining allowed balance", str(response.data))

    def test_hr_can_approve_reject_leave(self):
        # Create a pending leave request for Alice
        leave = Leave.objects.create(
            employee=self.employee1,
            leave_type='annual',
            start_date=datetime.date(2026, 7, 1),
            end_date=datetime.date(2026, 7, 5),
            status='pending'
        )
        
        # Bob (regular employee) tries to approve
        self.client.force_authenticate(user=self.user_emp2)
        approve_url = reverse('leave-approve', args=[leave.id])
        response = self.client.post(approve_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # HR approves
        self.client.force_authenticate(user=self.user_hr)
        response_hr = self.client.post(approve_url)
        self.assertEqual(response_hr.status_code, status.HTTP_200_OK)
        
        leave.refresh_from_db()
        self.assertEqual(leave.status, 'approved')
        
        # Reject an already approved request fails
        reject_url = reverse('leave-reject', args=[leave.id])
        response_reject = self.client.post(reject_url)
        self.assertEqual(response_reject.status_code, status.HTTP_400_BAD_REQUEST)

    def test_my_balance_endpoint(self):
        # Create approved leave of 5 days (Annual)
        Leave.objects.create(
            employee=self.employee1,
            leave_type='annual',
            start_date=datetime.date(datetime.date.today().year, 5, 1),
            end_date=datetime.date(datetime.date.today().year, 5, 5),
            status='approved'
        )
        
        # Create pending leave of 3 days (Annual)
        Leave.objects.create(
            employee=self.employee1,
            leave_type='annual',
            start_date=datetime.date(datetime.date.today().year, 6, 1),
            end_date=datetime.date(datetime.date.today().year, 6, 3),
            status='pending'
        )
        
        self.client.force_authenticate(user=self.user_emp1)
        response = self.client.get(self.balance_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        annual_balance = response.data['annual']
        
        self.assertEqual(annual_balance['total'], 21)
        self.assertEqual(annual_balance['used'], 5)
        self.assertEqual(annual_balance['pending'], 3)
        self.assertEqual(annual_balance['remaining'], 16) # 21 - 5
