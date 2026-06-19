"""
leave/views.py
--------------
LeaveViewSet  — full CRUD + approve / manager-approve / reject actions.
LeavePolicyView — GET/PATCH for the tenant's LeavePolicy configuration.

Balance endpoint now reads from the persisted LeaveBalance model (seeded from
LeavePolicy) instead of re-calculating on every request from raw Leave rows.
"""

from datetime import date
from decimal import Decimal

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Leave, LeaveBalance, LeavePolicy
from .serializers import LeaveSerializer, LeaveBalanceSerializer, LeavePolicySerializer
from employees.models import Employee
from core.permissions import IsHROrAdmin, IsAdmin


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_policy(tenant) -> LeavePolicy:
    """
    Return the tenant's LeavePolicy, creating a default one if it doesn't exist.
    Called lazily so existing tenants without a policy still work.
    """
    policy, _ = LeavePolicy.unscoped.get_or_create(tenant=tenant)
    return policy


def _get_or_seed_balance(employee, leave_type: str, year: int, policy: LeavePolicy) -> LeaveBalance:
    """
    Return the persisted LeaveBalance for an employee/type/year, creating and
    seeding it from the tenant LeavePolicy if it doesn't exist yet.
    """
    entitled = policy.get_limit(leave_type)
    balance, _ = LeaveBalance.unscoped.get_or_create(
        employee=employee,
        leave_type=leave_type,
        year=year,
        defaults={'entitled_days': Decimal(str(entitled)) if entitled else Decimal('0')},
    )
    return balance


# ── Main ViewSet ──────────────────────────────────────────────────────────────

class LeaveViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['approve', 'reject', 'stats']:
            return [permissions.IsAuthenticated(), IsHROrAdmin()]
        if self.action == 'manager_approve':
            # HR/Admin can also act as manager
            return [permissions.IsAuthenticated(), IsHROrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        tenant = self.request.user.tenant
        if self.request.user.role in ('ADMIN', 'HR'):
            return Leave.objects.filter(employee__tenant=tenant).order_by('-created_at')
        try:
            emp = Employee.objects.get(
                tenant=tenant, email=getattr(self.request.user, 'email', None)
            )
            return Leave.objects.filter(employee=emp).order_by('-created_at')
        except Employee.DoesNotExist:
            return Leave.objects.none()

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        if employee.tenant != self.request.user.tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'employee': 'Invalid employee for this tenant.'})

        leave_type = serializer.validated_data.get('leave_type')
        start_date = serializer.validated_data.get('start_date')
        end_date   = serializer.validated_data.get('end_date')

        if start_date > end_date:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'start_date': 'Start date must be before or equal to end date.'})

        requested_days = (end_date - start_date).days + 1

        # Use LeavePolicy for limit checks
        policy = _get_or_create_policy(self.request.user.tenant)
        limit  = policy.get_limit(leave_type)
        if limit is not None:
            balance = _get_or_seed_balance(employee, leave_type, start_date.year, policy)
            if balance.used_days + requested_days > limit:
                from rest_framework.exceptions import ValidationError
                remaining = int(limit - balance.used_days)
                raise ValidationError({
                    'non_field_errors': [
                        f"Requested {requested_days} days of {leave_type} leave exceeds "
                        f"remaining balance of {remaining} days for {start_date.year}."
                    ]
                })

        # Employees may only create requests for themselves
        if self.request.user.role not in ('ADMIN', 'HR'):
            if getattr(self.request.user, 'email', None) != getattr(employee, 'email', None):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You may only create leave requests for your own employee record.')

        serializer.save()

    # ── Balance ───────────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='my-balance')
    def my_balance(self, request):
        """
        Return leave balances for the requesting employee.
        HR/Admin may pass ?employee_id=<uuid> to query any employee.
        """
        tenant = request.user.tenant
        policy = _get_or_create_policy(tenant)

        # Resolve which employee to query
        employee_id = request.query_params.get('employee_id')
        if employee_id and request.user.role in ('ADMIN', 'HR'):
            try:
                emp = Employee.objects.get(id=employee_id, tenant=tenant)
            except Employee.DoesNotExist:
                return Response(
                    {'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND
                )
        else:
            try:
                emp = Employee.objects.get(
                    tenant=tenant, email=getattr(request.user, 'email', None)
                )
            except Employee.DoesNotExist:
                return Response(
                    {'error': 'No employee record linked to your account.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        current_year = date.today().year
        result = {}
        for leave_type, _ in [
            ('annual', None), ('sick', None),
            ('maternity', None), ('paternity', None), ('unpaid', None),
        ]:
            limit = policy.get_limit(leave_type)
            balance = _get_or_seed_balance(emp, leave_type, current_year, policy)

            # Count pending (not yet approved) to warn the user
            pending_days = sum(
                (lv.end_date - lv.start_date).days + 1
                for lv in Leave.objects.filter(
                    employee=emp,
                    leave_type=leave_type,
                    status='pending',
                    start_date__year=current_year,
                )
            )

            result[leave_type] = {
                'total':     limit,
                'entitled':  float(balance.entitled_days),
                'used':      float(balance.used_days),
                'pending':   pending_days,
                'remaining': float(balance.remaining_days) if limit is not None else None,
            }

        return Response(result)

    @action(detail=False, methods=['get'], url_path='balances')
    def balances(self, request):
        """
        HR/Admin: return persisted LeaveBalance records for all employees in the
        tenant for the current year, serialized via LeaveBalanceSerializer.
        """
        if request.user.role not in ('ADMIN', 'HR'):
            return Response(status=status.HTTP_403_FORBIDDEN)

        year = int(request.query_params.get('year', date.today().year))
        qs   = LeaveBalance.unscoped.filter(
            employee__tenant=request.user.tenant, year=year
        ).select_related('employee').order_by('employee__name', 'leave_type')
        serializer = LeaveBalanceSerializer(qs, many=True)
        return Response(serializer.data)

    # ── Stats ─────────────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def stats(self, request):
        tenant  = request.user.tenant
        policy  = _get_or_create_policy(tenant)
        qs      = Leave.objects.filter(employee__tenant=tenant)
        pending          = qs.filter(status='pending').count()
        manager_approved = qs.filter(status='manager_approved').count()
        approved         = qs.filter(status='approved').count()
        rejected         = qs.filter(status='rejected').count()
        return Response({
            'pending':          pending,
            'manager_approved': manager_approved,
            'approved':         approved,
            'rejected':         rejected,
            'policy':           policy.as_dict(),
        })

    # ── Approval actions ──────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='manager-approve')
    def manager_approve(self, request, pk=None):
        """
        First-stage approval by a line manager (HR or Admin role).
        Moves status from pending → manager_approved.
        """
        leave = self.get_object()
        if leave.status != 'pending':
            return Response(
                {'error': 'Only pending requests can be manager-approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        leave.status              = 'manager_approved'
        leave.manager_approved_by = request.user
        leave.save(update_fields=['status', 'manager_approved_by', 'updated_at'])
        return Response(LeaveSerializer(leave).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Final HR/Admin approval.
        Accepts from 'pending' (single-stage) OR 'manager_approved' (two-stage).
        Updates the LeaveBalance.used_days on approval.
        """
        leave = self.get_object()
        if leave.status not in ('pending', 'manager_approved'):
            return Response(
                {'error': 'Only pending or manager-approved requests can be approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        leave.status      = 'approved'
        leave.approved_by = request.user
        leave.save(update_fields=['status', 'approved_by', 'updated_at'])

        # Update persisted balance
        _sync_balance_on_approval(leave)

        return Response(LeaveSerializer(leave).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject from any non-terminal state."""
        leave = self.get_object()
        if leave.status in ('approved', 'rejected'):
            return Response(
                {'error': 'Already finalised — cannot reject.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # If it was previously approved, roll back the balance
        was_approved = leave.status == 'approved'
        leave.status      = 'rejected'
        leave.approved_by = request.user
        leave.save(update_fields=['status', 'approved_by', 'updated_at'])

        if was_approved:
            _sync_balance_on_rejection(leave)

        return Response(LeaveSerializer(leave).data)


# ── Balance sync helpers ───────────────────────────────────────────────────────

def _sync_balance_on_approval(leave: Leave):
    """Increment used_days in LeaveBalance when a leave is approved."""
    try:
        tenant  = leave.employee.tenant
        policy  = _get_or_create_policy(tenant)
        year    = leave.start_date.year
        balance = _get_or_seed_balance(leave.employee, leave.leave_type, year, policy)
        balance.used_days = Decimal(str(balance.used_days)) + Decimal(str(leave.days_requested))
        balance.save(update_fields=['used_days'])
    except Exception:
        pass   # Never crash the approval itself


def _sync_balance_on_rejection(leave: Leave):
    """Decrement used_days if a previously-approved leave is rejected."""
    try:
        year    = leave.start_date.year
        balance = LeaveBalance.unscoped.get(
            employee=leave.employee,
            leave_type=leave.leave_type,
            year=year,
        )
        balance.used_days = max(
            Decimal('0'),
            Decimal(str(balance.used_days)) - Decimal(str(leave.days_requested)),
        )
        balance.save(update_fields=['used_days'])
    except LeaveBalance.DoesNotExist:
        pass


# ── Leave Policy View ─────────────────────────────────────────────────────────

class LeavePolicyView(APIView):
    """
    GET  /api/leave/policy/  → return the tenant's leave policy
    PATCH /api/leave/policy/ → update entitlements (Admin only)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        policy = _get_or_create_policy(request.user.tenant)
        return Response(LeavePolicySerializer(policy).data)

    def patch(self, request):
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only Admins can update the leave policy.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        policy = _get_or_create_policy(request.user.tenant)
        serializer = LeavePolicySerializer(policy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
