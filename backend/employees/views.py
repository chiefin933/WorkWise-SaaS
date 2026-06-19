from rest_framework import viewsets, permissions, status, serializers, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError
import csv
import io
from .models import Employee
from .serializers import EmployeeListSerializer, EmployeeSerializer
from attendance.models import Attendance
from attendance.serializers import AttendanceSerializer
from leave.models import Leave
from leave.serializers import LeaveSerializer
from payroll.models import PayrollItem
from core.permissions import IsHROrAdmin, IsSelfOrHRAdmin


def _requesting_employee_for_user(user):
    """Helper: return Employee record that corresponds to the requesting user, if any."""
    try:
        return Employee.objects.get(tenant=user.tenant, email=getattr(user, 'email', None))
    except Employee.DoesNotExist:
        return None

class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'department', 'job_title']
    ordering_fields = ['name', 'salary_basic', 'hire_date']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeeListSerializer
        return EmployeeSerializer

    def get_permissions(self):
        # Tenant-wide directory management requires HR/Admin
        if self.action in ['list', 'create', 'bulk_import', 'destroy']:
            return [permissions.IsAuthenticated(), IsHROrAdmin()]
        # Retrieve and update: employee can access own record; HR/Admin can access any
        if self.action in ['retrieve', 'update', 'partial_update']:
            return [permissions.IsAuthenticated(), IsSelfOrHRAdmin()]
        # Other detail actions (attendance, leave, payslips) enforce self-check inline
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
                
                # Support multiple column name variants
                name = (
                    normalized_row.get('name', '') or
                    normalized_row.get('full name', '') or
                    normalized_row.get('employee name', '') or
                    normalized_row.get('fullname', '')
                ).strip()

                email = (
                    normalized_row.get('email', '') or
                    normalized_row.get('work email', '') or
                    normalized_row.get('email address', '')
                ).strip() or None

                phone = (
                    normalized_row.get('phone', '') or
                    normalized_row.get('phone number', '') or
                    normalized_row.get('mobile', '') or
                    normalized_row.get('mobile number', '')
                ).strip() or None

                department = (
                    normalized_row.get('department', '') or
                    normalized_row.get('dept', '')
                ).strip()

                job_title = (
                    normalized_row.get('job_title', '') or
                    normalized_row.get('job title', '') or
                    normalized_row.get('title', '') or
                    normalized_row.get('position', '')
                ).strip()

                kra_pin = (
                    normalized_row.get('kra_pin', '') or
                    normalized_row.get('kra pin', '') or
                    normalized_row.get('kra', '')
                ).strip() or None

                employment_type_raw = (
                    normalized_row.get('employment_type', '') or
                    normalized_row.get('employment type', '') or
                    normalized_row.get('type', '')
                ).strip().lower()
                # Map human-readable values to model choices
                employment_type_map = {
                    'monthly': 'monthly', 'weekly': 'weekly',
                    'daily': 'daily', 'hourly': 'hourly',
                }
                employment_type = employment_type_map.get(employment_type_raw, 'monthly')

                payment_method_raw = (
                    normalized_row.get('payment_method', '') or
                    normalized_row.get('payment method', '') or
                    normalized_row.get('payment', '')
                ).strip().lower()
                payment_method_map = {'bank': 'bank', 'mpesa': 'mpesa', 'm-pesa': 'mpesa'}
                payment_method = payment_method_map.get(payment_method_raw, 'bank')
                if not name:
                    errors.append(f"Row {row_num}: Missing name")
                    continue

                # Salary — supports multiple column names
                salary_raw = (
                    normalized_row.get('salary_basic', '') or
                    normalized_row.get('basic salary (kes)', '') or
                    normalized_row.get('basic salary', '') or
                    normalized_row.get('salary', '')
                )
                try:
                    salary_basic = float(str(salary_raw).replace(',', '').strip()) if salary_raw else 0
                except ValueError:
                    salary_basic = 0

                employees_to_create.append(
                    Employee(
                        tenant=tenant,
                        name=name,
                        email=email,
                        phone=phone,
                        department=department,
                        job_title=job_title,
                        kra_pin=kra_pin,
                        employment_type=employment_type,
                        salary_basic=salary_basic,
                        payment_method=payment_method,
                    )
                )

            if current_count + len(employees_to_create) > tenant.max_employees:
                return Response(
                    {"error": f"Importing these {len(employees_to_create)} employees would exceed your plan limit of {tenant.max_employees}. You currently have {current_count}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if errors and not employees_to_create:
                return Response({"error": "No valid employees found.", "details": errors[:10]}, status=status.HTTP_400_BAD_REQUEST)

            # Upsert: bulk update existing employees, bulk create new ones
            created_count = 0
            updated_count = 0

            if employees_to_create:
                # Split into those with email (can match existing) and those without
                with_email = [e for e in employees_to_create if e.email]
                without_email = [e for e in employees_to_create if not e.email]

                # Bulk update existing employees matched by email in one query
                existing_emails = {
                    e.lower() for e in Employee.unscoped.filter(
                        tenant=tenant,
                        email__in=[e.email for e in with_email]
                    ).values_list('email', flat=True)
                }

                to_update = [e for e in with_email if e.email.lower() in existing_emails]
                to_create = [e for e in with_email if e.email.lower() not in existing_emails] + without_email

                # Bulk update via update_fields on filtered queryset
                for emp_obj in to_update:
                    Employee.unscoped.filter(tenant=tenant, email__iexact=emp_obj.email).update(
                        name=emp_obj.name,
                        phone=emp_obj.phone,
                        department=emp_obj.department,
                        job_title=emp_obj.job_title,
                        kra_pin=emp_obj.kra_pin,
                        employment_type=emp_obj.employment_type,
                        salary_basic=emp_obj.salary_basic,
                        payment_method=emp_obj.payment_method,
                    )
                updated_count = len(to_update)

                # Bulk create new employees in a single query
                for e in to_create:
                    e._skip_signal = True
                Employee.objects.bulk_create(to_create, ignore_conflicts=True)
                created_count = len(to_create)

            # Send a single summary notification for the whole import
            if created_count > 0:
                try:
                    from users.models import User, Notification
                    admins = User.objects.filter(tenant=tenant, role='ADMIN')
                    for admin in admins:
                        Notification.objects.create(
                            tenant=tenant,
                            recipient=admin,
                            type='employee',
                            title='Bulk Employee Import Complete',
                            message=f'{created_count} employee(s) added and {updated_count} updated via CSV import.',
                            action_url='/employees',
                        )
                except Exception:
                    pass

            msg = f"Import complete: {created_count} created, {updated_count} updated."
            return Response({
                "message": msg,
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
