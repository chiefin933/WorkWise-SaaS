from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Leave
from employees.models import Employee
from .serializers import LeaveSerializer
from core.permissions import IsHROrAdmin


class LeaveViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Approvals and tenant-wide stats require HR/Admin
        if self.action in ['approve', 'reject', 'stats']:
            return [permissions.IsAuthenticated(), IsHROrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        # HR/Admin can view all tenant leaves; employees only their own
        tenant = self.request.user.tenant
        if self.request.user.role in ('ADMIN', 'HR'):
            return Leave.objects.filter(employee__tenant=tenant).order_by('-created_at')
        # try to resolve the employee linked to the user via email
        try:
            emp = Employee.objects.get(tenant=tenant, email=getattr(self.request.user, 'email', None))
            return Leave.objects.filter(employee=emp).order_by('-created_at')
        except Employee.DoesNotExist:
            return Leave.objects.none()

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        if employee.tenant != self.request.user.tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"employee": "Invalid employee for this tenant."})
            
        leave_type = serializer.validated_data.get('leave_type')
        start_date = serializer.validated_data.get('start_date')
        end_date = serializer.validated_data.get('end_date')
        
        if start_date > end_date:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"start_date": "Start date must be before or equal to end date."})
            
        requested_days = (end_date - start_date).days + 1
        
        # Policy limits
        policy = {
            'annual': 21,
            'sick': 30,
            'maternity': 90,
            'paternity': 14,
        }
        
        limit = policy.get(leave_type)
        if limit:
            # Query existing approved leaves for the employee in the same calendar year
            existing_leaves = Leave.objects.filter(
                employee=employee,
                leave_type=leave_type,
                status='approved',
                start_date__year=start_date.year
            )
            
            approved_days = 0
            for lv in existing_leaves:
                approved_days += (lv.end_date - lv.start_date).days + 1
                
            if approved_days + requested_days > limit:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    "non_field_errors": [
                        f"Requested {requested_days} days of {leave_type} leave exceeds remaining allowed balance of {limit - approved_days} days for this year."
                    ]
                })
                
        # If not HR/Admin, ensure employees can only create leaves for themselves
        if self.request.user.role not in ('ADMIN', 'HR'):
            if getattr(self.request.user, 'email', None) != getattr(employee, 'email', None):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You may only create leave requests for your own employee record.")
        serializer.save()

    @action(detail=False, methods=['get'])
    def stats(self, request):
        tenant = request.user.tenant
        qs = Leave.objects.filter(employee__tenant=tenant)
        pending = qs.filter(status='pending').count()
        approved = qs.filter(status='approved').count()
        rejected = qs.filter(status='rejected').count()
        return Response({
            'pending': pending,
            'approved': approved,
            'rejected': rejected,
            'policy': {
                'annual': 21,
                'sick': 30,
                'maternity': 90,
                'paternity': 14,
                'notice_days': 14,
            },
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        leave = self.get_object()
        if leave.status != 'pending':
            return Response({"error": "Only pending requests can be approved"}, status=status.HTTP_400_BAD_REQUEST)
        leave.status = 'approved'
        leave.save(update_fields=['status', 'updated_at'])
        return Response(LeaveSerializer(leave).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        leave = self.get_object()
        if leave.status != 'pending':
            return Response({"error": "Only pending requests can be rejected"}, status=status.HTTP_400_BAD_REQUEST)
        leave.status = 'rejected'
        leave.save(update_fields=['status', 'updated_at'])
        return Response(LeaveSerializer(leave).data)
