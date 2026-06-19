import datetime
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile

from tenants.models import Tenant
from employees.models import Employee
from attendance.models import Attendance
from leave.models import Leave

User = get_user_model()

class AttendanceTests(APITestCase):
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
        self.user_hr = User.objects.create_user(
            email="hr@acme.com",
            password="password123",
            tenant=self.tenant,
            role="HR"
        )
        
        self.clock_in_url = reverse('attendance-clock-in')
        self.clock_out_url = reverse('attendance-clock-out')
        self.presence_matrix_url = reverse('attendance-presence-matrix')
        self.upload_bulk_url = reverse('attendance-upload-bulk')

    def test_clock_in_success(self):
        self.client.force_authenticate(user=self.user_emp1)
        
        fixed_time = datetime.datetime(2026, 6, 15, 8, 30, 0, tzinfo=datetime.timezone.utc)
        with patch('django.utils.timezone.now', return_value=fixed_time):
            response = self.client.post(self.clock_in_url, {
                'employee': self.employee1.id,
                'location': 'HQ',
                'latitude': '1.292100',
                'longitude': '36.821900'
            })
            
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['location'], 'HQ')
        self.assertEqual(response.data['clock_in'][:5], '08:30')
        
        attendance = Attendance.objects.get(employee=self.employee1, date=fixed_time.date())
        self.assertEqual(attendance.location, 'HQ')
        self.assertEqual(attendance.clock_in.hour, 8)
        self.assertEqual(attendance.clock_in.minute, 30)

    def test_clock_in_duplicate_prevention(self):
        self.client.force_authenticate(user=self.user_emp1)
        fixed_time = datetime.datetime(2026, 6, 15, 8, 30, 0, tzinfo=datetime.timezone.utc)
        
        with patch('django.utils.timezone.now', return_value=fixed_time):
            # First clock-in
            response = self.client.post(self.clock_in_url, {'employee': self.employee1.id})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
            # Second clock-in on same day
            response2 = self.client.post(self.clock_in_url, {'employee': self.employee1.id})
            self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("Already clocked in today", response2.data['error'])

    def test_clock_in_unauthorized_other_employee(self):
        self.client.force_authenticate(user=self.user_emp1)
        # alice tries to clock-in for bob
        response = self.client.post(self.clock_in_url, {'employee': self.employee2.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_clock_in_hr_can_clock_in_others(self):
        self.client.force_authenticate(user=self.user_hr)
        fixed_time = datetime.datetime(2026, 6, 15, 8, 30, 0, tzinfo=datetime.timezone.utc)
        
        with patch('django.utils.timezone.now', return_value=fixed_time):
            response = self.client.post(self.clock_in_url, {'employee': self.employee2.id})
            
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_clock_out_success_and_calculation(self):
        self.client.force_authenticate(user=self.user_emp1)
        today = timezone.now().date()
        
        # Manually seed a clock-in record at 08:00 AM
        att = Attendance.objects.create(
            employee=self.employee1,
            date=today,
            clock_in=datetime.time(8, 0, 0),
            location="HQ"
        )
        
        # Clock out at 18:30 PM (10.5 hours worked)
        clock_out_time = datetime.datetime(today.year, today.month, today.day, 18, 30, 0, tzinfo=datetime.timezone.utc)
        with patch('django.utils.timezone.now', return_value=clock_out_time):
            response = self.client.post(self.clock_out_url, {'employee': self.employee1.id})
            
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        att.refresh_from_db()
        self.assertEqual(float(att.hours_worked), 10.5)
        self.assertEqual(float(att.overtime_hours), 2.5) # 10.5 - 8.0

    def test_clock_out_without_clock_in(self):
        self.client.force_authenticate(user=self.user_emp1)
        response = self.client.post(self.clock_out_url, {'employee': self.employee1.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Must clock in first", response.data['error'])

    def test_presence_matrix_endpoint(self):
        # HR access
        self.client.force_authenticate(user=self.user_hr)
        
        today = timezone.now().date()
        
        # 1. Alice is present (clocked in at 08:30 AM <= 09:00 AM)
        Attendance.objects.create(
            employee=self.employee1,
            date=today,
            clock_in=datetime.time(8, 30, 0)
        )
        
        # 2. Bob is on leave
        Leave.objects.create(
            employee=self.employee2,
            leave_type='annual',
            start_date=today,
            end_date=today,
            status='approved'
        )
        
        response = self.client.get(self.presence_matrix_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Matrix should have 2 active employees
        self.assertEqual(len(response.data), 2)
        
        alice_data = next(item for item in response.data if item['employee_id'] == str(self.employee1.id))
        bob_data = next(item for item in response.data if item['employee_id'] == str(self.employee2.id))
        
        self.assertEqual(alice_data['status'], 'Present')
        self.assertEqual(bob_data['status'], 'On Leave')

    def test_bulk_import_attendance_success(self):
        self.client.force_authenticate(user=self.user_hr)
        
        csv_content = (
            "employee_email,date,clock_in,clock_out,location\n"
            f"alice@acme.com,2026-06-10,08:15,17:15,HQ\n"
            f"bob@acme.com,2026-06-10,09:15,18:15,Remote\n"
        )
        
        csv_file = SimpleUploadedFile("attendance.csv", csv_content.encode('utf-8-sig'), content_type="text/csv")
        response = self.client.post(self.upload_bulk_url, {'file': csv_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Attendance.objects.filter(employee__tenant=self.tenant).count(), 2)
        
        att_alice = Attendance.objects.get(employee=self.employee1, date=datetime.date(2026, 6, 10))
        self.assertEqual(att_alice.clock_in, datetime.time(8, 15))
        self.assertEqual(float(att_alice.hours_worked), 9.0)
        self.assertEqual(float(att_alice.overtime_hours), 1.0)
