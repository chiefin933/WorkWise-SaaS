from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError
import csv
import io
from .models import Employee
from .serializers import EmployeeSerializer
from attendance.models import Attendance
from attendance.serializers import AttendanceSerializer
from leave.models import Leave
from leave.serializers import LeaveSerializer
from payroll.models import PayrollItem
from core.permissions import IsHROrAdmin


def _requesting_employee_for_user(user):
    """Helper: return Employee record that corresponds to the requesting user, if any."""
    try:
        return Employee.objects.get(tenant=user.tenant, email=getattr(user, 'email', None))
    except Employee.DoesNotExist:
        return None

class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Tenant-wide directory management requires HR/Admin
        if self.action in ['list', 'create', 'bulk_import', 'destroy']:
            return [permissions.IsAuthenticated(), IsHROrAdmin()]
        # Detail views are allowed for the employee themself or HR/Admin
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        # Only return employees for the user's tenant
        qs = Employee.objects.filter(tenant=self.request.user.tenant)
        if self.request.user.role in ('ADMIN', 'HR'):
            return qs

        requesting_employee = _requesting_employee_for_user(self.request.user)
        if not requesting_employee:
            return Employee.objects.none()
        return qs.filter(id=requesting_employee.id)

    def perform_create(self, serializer):
        tenant = self.request.user.tenant
        current_count = Employee.objects.filter(tenant=tenant).count()
        
        if current_count >= tenant.max_employees:
            raise ValidationError(f"You have reached the employee limit for your {tenant.get_plan_display()}. Please upgrade your plan to add more employees.")
        
        serializer.save(tenant=tenant)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def bulk_import(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # ── Security guards ───────────────────────────────────────────────────
        MAX_FILE_SIZE = 5 * 1024 * 1024   # 5 MB
        MAX_ROWS      = 1000              # hard cap per import batch
        ALLOWED_TYPES = {'text/csv', 'text/plain', 'application/csv',
                         'application/octet-stream'}

        if file.size > MAX_FILE_SIZE:
            return Response(
                {"error": f"File too large. Maximum allowed size is 5 MB."},
                status=status.HTTP_400_BAD_REQUEST
            )

        content_type = (file.content_type or '').split(';')[0].strip().lower()
        if content_type not in ALLOWED_TYPES and not file.name.lower().endswith('.csv'):
            return Response(
                {"error": "Invalid file type. Only CSV files are supported."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not file.name.lower().endswith('.csv'):
            return Response({"error": "Only CSV files are supported"}, status=status.HTTP_400_BAD_REQUEST)

        tenant = request.user.tenant
        current_count = Employee.objects.filter(tenant=tenant).count()
        
        try:
            decoded_file = file.read().decode('utf-8-sig')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            employees_to_create = []
            errors = []
            row_num = 1

            for row in reader:
                row_num += 1

                if row_num > MAX_ROWS + 1:   # +1 because row_num starts at 1 (header)
                    errors.append(f"Import stopped: maximum of {MAX_ROWS} rows per upload.")
                    break
                normalized_row = {str(k).strip().lower(): v for k, v in row.items() if k is not None}
                
                name = normalized_row.get('name', '').strip()
                if not name:
                    name = normalized_row.get('full name', '').strip() or normalized_row.get('employee name', '').strip()

                email = normalized_row.get('email', '').strip() or None
                if not name:
                    errors.append(f"Row {row_num}: Missing 'name'")
                    continue
                
                # Try to safely parse salary
                salary_raw = normalized_row.get('salary_basic', '') or normalized_row.get('salary', '') or normalized_row.get('basic salary', '')
                try:
                    salary_basic = float(str(salary_raw).replace(',', '').strip()) if salary_raw else 0
                except ValueError:
                    salary_basic = 0

                employees_to_create.append(
                    Employee(
                        tenant=tenant,
                        name=name,
                        email=email,
                        phone=normalized_row.get('phone', '').strip() or None,
                        department=normalized_row.get('department', '').strip(),
                        job_title=normalized_row.get('job_title', '').strip() or normalized_row.get('job title', '').strip() or normalized_row.get('title', '').strip(),
                        salary_basic=salary_basic,
                    )
                )

            if current_count + len(employees_to_create) > tenant.max_employees:
                return Response(
                    {"error": f"Importing these {len(employees_to_create)} employees would exceed your plan limit of {tenant.max_employees}. You currently have {current_count}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if errors and not employees_to_create:
                return Response({"error": "No valid employees found.", "details": errors[:10]}, status=status.HTTP_400_BAD_REQUEST)
                
            Employee.objects.bulk_create(employees_to_create, ignore_conflicts=True)
            
            return Response({
                "message": f"Successfully imported {len(employees_to_create)} employees.",
                "warnings": errors[:10] if errors else []
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"error": f"Error parsing CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def attendance(self, request, pk=None):
        employee = self.get_object()
        # Only HR/Admin may view arbitrary employee attendance; otherwise only self
        if request.user.role not in ('ADMIN', 'HR'):
            req_emp = _requesting_employee_for_user(request.user)
            if not req_emp or req_emp.id != employee.id:
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        logs = Attendance.objects.filter(employee=employee).order_by('-date', '-clock_in')
        serializer = AttendanceSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def leave(self, request, pk=None):
        employee = self.get_object()
        if request.user.role not in ('ADMIN', 'HR'):
            req_emp = _requesting_employee_for_user(request.user)
            if not req_emp or req_emp.id != employee.id:
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        requests = Leave.objects.filter(employee=employee).order_by('-start_date')
        serializer = LeaveSerializer(requests, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def payslips(self, request, pk=None):
        class EmployeePayslipSerializer(serializers.ModelSerializer):
            month = serializers.IntegerField(source='payroll_run.month', read_only=True)
            year = serializers.IntegerField(source='payroll_run.year', read_only=True)
            status = serializers.CharField(source='payroll_run.status', read_only=True)

            class Meta:
                model = PayrollItem
                fields = (
                    'id', 'payroll_run', 'gross_salary', 'nssf', 'shif', 'ahl',
                    'paye', 'net_pay', 'month', 'year', 'status'
                )

        employee = self.get_object()
        if request.user.role not in ('ADMIN', 'HR'):
            req_emp = _requesting_employee_for_user(request.user)
            if not req_emp or req_emp.id != employee.id:
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        items = PayrollItem.objects.filter(employee=employee).order_by('-payroll_run__year', '-payroll_run__month')
        serializer = EmployeePayslipSerializer(items, many=True)
        return Response(serializer.data)
