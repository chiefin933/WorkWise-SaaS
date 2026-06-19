from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from tenants.models import Tenant
from employees.models import Employee

User = get_user_model()

class EmployeeTests(APITestCase):
    def setUp(self):
        # Create Starter Tenant (limit = 15)
        self.tenant = Tenant.objects.create(name="Acme Corp", plan="STARTER")
        
        # Create HR/Admin User
        self.user_hr = User.objects.create_user(
            email="hr@acme.com",
            password="password123",
            tenant=self.tenant,
            role="HR"
        )
        
        # Create Regular Employee User
        self.employee1 = Employee.objects.create(
            tenant=self.tenant,
            name="Alice Employee",
            email="alice@acme.com",
            status="active"
        )
        self.user_emp1 = User.objects.create_user(
            email="alice@acme.com",
            password="password123",
            tenant=self.tenant,
            role="EMPLOYEE"
        )
        
        self.employee2 = Employee.objects.create(
            tenant=self.tenant,
            name="Bob Employee",
            email="bob@acme.com",
            status="active"
        )
        
        self.list_url = reverse('employee-list')
        self.bulk_import_url = reverse('employee-bulk-import')

    def test_hr_can_create_employee_within_limit(self):
        self.client.force_authenticate(user=self.user_hr)
        payload = {
            "name": "Charlie Employee",
            "email": "charlie@acme.com",
            "department": "Engineering",
            "salary_basic": "50000.00",
            "employment_type": "monthly"
        }
        
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Employee.objects.filter(tenant=self.tenant).count(), 3)

    def test_create_employee_seat_limit_enforced(self):
        # Currently we have 2 employees (Alice, Bob). Let's add 13 more to reach the limit of 15.
        for i in range(13):
            Employee.objects.create(
                tenant=self.tenant,
                name=f"Extra {i}",
                email=f"extra{i}@acme.com",
                status="active"
            )
        
        self.client.force_authenticate(user=self.user_hr)
        payload = {
            "name": "Charlie Employee",
            "email": "charlie@acme.com",
            "salary_basic": "50000.00"
        }
        
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("limit", str(response.data))

    def test_employee_detail_access_rules(self):
        # Alice tries to view Bob's profile (returns 404 because queryset hides it)
        self.client.force_authenticate(user=self.user_emp1)
        url = reverse('employee-detail', args=[self.employee2.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Alice views her own profile (success)
        url_self = reverse('employee-detail', args=[self.employee1.id])
        response_self = self.client.get(url_self)
        self.assertEqual(response_self.status_code, status.HTTP_200_OK)
        self.assertEqual(response_self.data['name'], 'Alice Employee')

    def test_bulk_import_employees_success_under_limit(self):
        self.client.force_authenticate(user=self.user_hr)
        
        # CSV content with UTF-8 BOM representation
        csv_content = (
            "name,email,phone,department,job_title,salary_basic\n"
            "Dave Employee,dave@acme.com,+254700111222,Sales,Sales Rep,40000\n"
            "Eve Employee,eve@acme.com,+254700222333,HR,HR Asst,45000\n"
        )
        
        csv_file = SimpleUploadedFile("employees.csv", csv_content.encode('utf-8-sig'), content_type="text/csv")
        response = self.client.post(self.bulk_import_url, {'file': csv_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Employee.objects.filter(tenant=self.tenant).count(), 4) # 2 original + 2 imported
        
        dave = Employee.objects.get(tenant=self.tenant, email="dave@acme.com")
        self.assertEqual(dave.name, "Dave Employee")
        self.assertEqual(float(dave.salary_basic), 40000.0)

    def test_bulk_import_seat_limit_exceeded(self):
        # Currently we have 2 employees. Let's add 12 more to reach 14 (leaving 1 spot).
        for i in range(12):
            Employee.objects.create(
                tenant=self.tenant,
                name=f"Extra {i}",
                email=f"extra{i}@acme.com",
                status="active"
            )
            
        self.client.force_authenticate(user=self.user_hr)
        
        # Trying to bulk import 2 employees when only 1 spot is left should fail.
        csv_content = (
            "name,email,salary_basic\n"
            "Dave Employee,dave@acme.com,40000\n"
            "Eve Employee,eve@acme.com,45000\n"
        )
        
        csv_file = SimpleUploadedFile("employees.csv", csv_content.encode('utf-8-sig'), content_type="text/csv")
        response = self.client.post(self.bulk_import_url, {'file': csv_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceed your plan limit", response.data['error'])
        # Verify only the 14 employees exist
        self.assertEqual(Employee.objects.filter(tenant=self.tenant).count(), 14)

    def test_bulk_import_guards(self):
        self.client.force_authenticate(user=self.user_hr)
        
        # 1. Invalid file extension / type
        txt_file = SimpleUploadedFile("employees.txt", b"some plain text", content_type="text/plain")
        response = self.client.post(self.bulk_import_url, {'file': txt_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # 2. File size too large (exceeds 5MB)
        large_content = b"a" * (5 * 1024 * 1024 + 100) # > 5MB
        large_file = SimpleUploadedFile("large.csv", large_content, content_type="text/csv")
        response2 = self.client.post(self.bulk_import_url, {'file': large_file}, format='multipart')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("File too large", response2.data['error'])
