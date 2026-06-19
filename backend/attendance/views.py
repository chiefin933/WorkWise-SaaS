import math
import logging

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Attendance
from .serializers import AttendanceSerializer
from employees.models import Employee
from leave.models import Leave
from core.permissions import IsHROrAdmin

logger = logging.getLogger(__name__)


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in metres between two GPS coordinates."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _requesting_employee_for_user(user):
    try:
        return Employee.objects.get(tenant=user.tenant, email=getattr(user, 'email', None))
    except Employee.DoesNotExist:
        return None


def _check_geofence(tenant, lat, lon):
    """
    If the tenant's PayrollConfig defines office coordinates and a geofence
    radius, validate that the supplied coordinates are within range.

    Returns (within: bool, distance_m: float | None, radius_m: float | None).
    Returns (True, None, None) when geofencing is not configured — never blocks.
    """
    try:
        config = tenant.payroll_config
        office_lat = float(config.office_latitude or 0)
        office_lon = float(config.office_longitude or 0)
        radius     = float(config.geofence_radius_meters or 0)
        if not office_lat or not office_lon or not radius:
            return True, None, None
        distance = _haversine_meters(lat, lon, office_lat, office_lon)
        return distance <= radius, round(distance), round(radius)
    except Exception:
        # Geofence config absent or any error → non-blocking
        return True, None, None


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Tenant-wide analytics and bulk operations require HR/Admin
        if self.action in ['presence_matrix', 'upload_bulk', 'stats']:
            return [permissions.IsAuthenticated(), IsHROrAdmin()]
        # Clock-in/clock-out and individual record access allowed to authenticated users
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Attendance.objects.filter(employee__tenant=self.request.user.tenant).order_by('-date', '-clock_in')
        if self.request.user.role not in ('ADMIN', 'HR'):
            requesting_employee = _requesting_employee_for_user(self.request.user)
            if not requesting_employee:
                return Attendance.objects.none()
            qs = qs.filter(employee=requesting_employee)

        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if month and year:
            qs = qs.filter(date__month=int(month), date__year=int(year))
        return qs

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        if employee.tenant != self.request.user.tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"employee": "Invalid employee for this tenant."})
        if self.request.user.role not in ('ADMIN', 'HR'):
            requesting_employee = _requesting_employee_for_user(self.request.user)
            if not requesting_employee or requesting_employee.id != employee.id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You may only create attendance for your own employee record.")
        serializer.save()

    @action(detail=False, methods=['get'])
    def stats(self, request):
        tenant = request.user.tenant
        today = timezone.now().date()
        month = int(request.query_params.get('month', today.month))
        year = int(request.query_params.get('year', today.year))

        logs = Attendance.objects.filter(
            employee__tenant=tenant,
            date__month=month,
            date__year=year,
        )
        total_logs = logs.count()
        total_hours = logs.aggregate(total=Sum('hours_worked'))['total'] or 0
        on_time = logs.filter(clock_in__lte='09:00:00').count()
        on_time_rate = round((on_time / total_logs) * 100) if total_logs else 0
        unique_employees = logs.values('employee').distinct().count()

        return Response({
            'month': month,
            'year': year,
            'total_logs': total_logs,
            'total_hours': float(total_hours),
            'on_time_rate': on_time_rate,
            'unique_employees': unique_employees,
        })

    @action(detail=False, methods=['post'], url_path='clock-in')
    def clock_in(self, request):
        employee_id = request.data.get('employee')
        if not employee_id:
            return Response({"error": "Employee ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            employee = Employee.objects.get(id=employee_id, tenant=request.user.tenant)
        except Employee.DoesNotExist:
            return Response({"error": "Employee not found in your organization"}, status=status.HTTP_404_NOT_FOUND)

        # Non-HR users may only clock themselves
        if request.user.role not in ('ADMIN', 'HR'):
            req_emp = _requesting_employee_for_user(request.user)
            if not req_emp or str(req_emp.id) != str(employee_id):
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        
        today = timezone.now().date()
        lat = request.data.get('latitude')
        lon = request.data.get('longitude')

        # Geofence validation — warning only, never blocks clock-in
        geofence_warning = None
        if lat is not None and lon is not None:
            try:
                within, distance_m, radius_m = _check_geofence(
                    request.user.tenant, float(lat), float(lon)
                )
                if radius_m is not None and not within:
                    geofence_warning = (
                        f"You are {distance_m}m from the office "
                        f"(geofence radius: {radius_m}m). Clock-in recorded but flagged."
                    )
                    logger.warning(
                        "Geofence breach: employee=%s distance=%dm radius=%dm",
                        employee.name, distance_m, radius_m,
                    )
            except (TypeError, ValueError):
                pass

        attendance, created = Attendance.objects.get_or_create(
            employee=employee,
            date=today,
            defaults={
                'clock_in': timezone.now().time(),
                'location': request.data.get('location', 'Office'),
                'latitude': lat,
                'longitude': lon,
            }
        )
        
        if not created:
            if attendance.clock_in:
                return Response({"error": "Already clocked in today"}, status=status.HTTP_400_BAD_REQUEST)
            attendance.clock_in = timezone.now().time()
            attendance.location = request.data.get('location', 'Office')
            attendance.latitude = lat
            attendance.longitude = lon
            attendance.save()

        response_data = AttendanceSerializer(attendance).data
        if geofence_warning:
            response_data['geofence_warning'] = geofence_warning
        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='clock-out')
    def clock_out(self, request):
        employee_id = request.data.get('employee')
        if not employee_id:
            return Response({"error": "Employee ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            employee = Employee.objects.get(id=employee_id, tenant=request.user.tenant)
        except Employee.DoesNotExist:
            return Response({"error": "Employee not found in your organization"}, status=status.HTTP_404_NOT_FOUND)

        # Non-HR users may only clock themselves out
        if request.user.role not in ('ADMIN', 'HR'):
            req_emp = _requesting_employee_for_user(request.user)
            if not req_emp or str(req_emp.id) != str(employee_id):
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
            
        today = timezone.now().date()
        try:
            attendance = Attendance.objects.get(employee=employee, date=today)
        except Attendance.DoesNotExist:
            return Response({"error": "No clock-in record found for today. Must clock in first."}, status=status.HTTP_400_BAD_REQUEST)
            
        if attendance.clock_out:
            return Response({"error": "Already clocked out today"}, status=status.HTTP_400_BAD_REQUEST)
            
        attendance.clock_out = timezone.now().time()
        attendance.save() # Saves and calculates hours/overtime
        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='presence-matrix')
    def presence_matrix(self, request):
        tenant = request.user.tenant
        today = timezone.now().date()
        
        # 1. Fetch active employees
        employees = Employee.objects.filter(tenant=tenant, status='active').order_by('name')
        
        # 2. Fetch today's attendance logs
        logs = Attendance.objects.filter(employee__tenant=tenant, date=today)
        logs_map = {log.employee_id: log for log in logs}
        
        # 3. Fetch today's active approved leaves
        leaves = Leave.objects.filter(
            employee__tenant=tenant,
            status='approved',
            start_date__lte=today,
            end_date__gte=today
        )
        leaves_map = {lv.employee_id: lv for lv in leaves}
        
        matrix = []
        for emp in employees:
            status_val = 'Absent'
            clock_in_time = None
            clock_out_time = None
            hours_worked_val = 0
            
            # Check leave first
            if emp.id in leaves_map:
                status_val = 'On Leave'
            elif emp.id in logs_map:
                log = logs_map[emp.id]
                clock_in_time = log.clock_in.strftime('%H:%M:%S') if log.clock_in else None
                clock_out_time = log.clock_out.strftime('%H:%M:%S') if log.clock_out else None
                hours_worked_val = float(log.hours_worked)
                
                # Punctuality threshold: 9:00 AM
                if log.clock_in:
                    import datetime
                    threshold = datetime.time(9, 0, 0)
                    if log.clock_in <= threshold:
                        status_val = 'Present'
                    else:
                        status_val = 'Late'
            
            matrix.append({
                'employee_id': str(emp.id),
                'employee_name': emp.name,
                'department': getattr(emp, 'department', 'General'),
                'status': status_val,
                'clock_in': clock_in_time,
                'clock_out': clock_out_time,
                'hours_worked': hours_worked_val,
                'date': today.isoformat()
            })
            
        return Response(matrix, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='upload-bulk')
    def upload_bulk(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
            
        import csv
        import datetime
        
        tenant = request.user.tenant
        
        # Read the file
        decoded_file = file.read().decode('utf-8-sig').splitlines()
        reader = csv.DictReader(decoded_file)
        
        # Ensure standard columns are present
        required_cols = ['employee_email', 'date', 'clock_in', 'clock_out']
        for col in required_cols:
            if col not in (reader.fieldnames or []):
                return Response({"error": f"Missing required column: {col}"}, status=status.HTTP_400_BAD_REQUEST)
                
        processed_count = 0
        errors = []
        
        for idx, row in enumerate(reader):
            email = row.get('employee_email', '').strip()
            date_str = row.get('date', '').strip()
            clock_in_str = row.get('clock_in', '').strip()
            clock_out_str = row.get('clock_out', '').strip()
            location_str = row.get('location', 'Office').strip()
            
            try:
                emp = Employee.objects.get(email=email, tenant=tenant)
                # Parse date and times
                date_val = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
                
                # Create or update Attendance
                att, created = Attendance.objects.get_or_create(
                    employee=emp,
                    date=date_val,
                )
                
                if clock_in_str:
                    att.clock_in = datetime.datetime.strptime(clock_in_str, '%H:%M').time()
                if clock_out_str:
                    att.clock_out = datetime.datetime.strptime(clock_out_str, '%H:%M').time()
                    
                att.location = location_str
                att.save()
                processed_count += 1
            except Employee.DoesNotExist:
                errors.append(f"Row {idx+1}: Employee with email {email} not found in this organization.")
            except Exception as e:
                errors.append(f"Row {idx+1}: {str(e)}")
                
        return Response({
            "message": f"Successfully processed {processed_count} attendance records.",
            "errors": errors
        }, status=status.HTTP_200_OK)
