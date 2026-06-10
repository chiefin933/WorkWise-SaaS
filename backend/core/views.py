from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsHROrAdmin

from employees.models import Employee
from leave.models import Leave
from attendance.models import Attendance
from payroll.models import PayrollRun, PayrollItem
from .audit import AuditLog
from .tenant_utils import tenant_required


class DashboardStatsView(APIView):
    permission_classes = (IsAuthenticated, IsHROrAdmin)

    def get(self, request):
        tenant, err = tenant_required(request)
        if err:
            return err

        today = timezone.now().date()
        month, year = today.month, today.year

        total_employees = Employee.objects.filter(tenant=tenant, status='active').count()
        pending_leaves = Leave.objects.filter(
            employee__tenant=tenant,
            status='pending',
        ).count()

        current_run = PayrollRun.objects.filter(
            tenant=tenant, month=month, year=year, status__in=['processed', 'approved', 'paid']
        ).first()

        monthly_payroll_cost = Decimal('0')
        if current_run:
            monthly_payroll_cost = PayrollItem.objects.filter(
                payroll_run=current_run
            ).aggregate(total=Sum('net_pay'))['total'] or Decimal('0')
        else:
            latest_run = PayrollRun.objects.filter(
                tenant=tenant, status__in=['processed', 'approved', 'paid']
            ).order_by('-year', '-month').first()
            if latest_run:
                monthly_payroll_cost = PayrollItem.objects.filter(
                    payroll_run=latest_run
                ).aggregate(total=Sum('net_pay'))['total'] or Decimal('0')

        month_attendance = Attendance.objects.filter(
            employee__tenant=tenant,
            date__month=month,
            date__year=year,
        )
        attendance_days = month_attendance.count()
        expected_days = max(total_employees * 22, 1)
        attendance_rate = min(100, round((attendance_days / expected_days) * 100))

        approved_leaves = Leave.objects.filter(
            employee__tenant=tenant,
            status='approved',
            start_date__year=year,
        ).count()
        leave_utilization = min(100, round((approved_leaves / max(total_employees, 1)) * 100))

        alerts = pending_leaves
        if tenant.subscription_status == 'TRIAL' and tenant.trial_ends_at:
            if tenant.trial_ends_at.date() <= today + timedelta(days=7):
                alerts += 1

        recent_activities = []
        for leave in Leave.objects.filter(employee__tenant=tenant).order_by('-created_at')[:3]:
            recent_activities.append({
                'title': f'{leave.get_leave_type_display()} request',
                'description': f'{leave.employee.name} — {leave.get_status_display()}',
                'time': leave.created_at.isoformat(),
            })
        for run in PayrollRun.objects.filter(tenant=tenant).order_by('-created_at')[:2]:
            recent_activities.append({
                'title': f'Payroll {run.month}/{run.year}',
                'description': f'Status: {run.get_status_display()}',
                'time': run.created_at.isoformat(),
            })
        recent_activities.sort(key=lambda x: x['time'], reverse=True)
        recent_activities = recent_activities[:5]

        suggestion = None
        if total_employees == 0:
            suggestion = 'Add your first employee to unlock payroll and attendance.'
        elif pending_leaves > 0:
            suggestion = f'You have {pending_leaves} leave request(s) awaiting approval.'
        elif not PayrollRun.objects.filter(tenant=tenant, month=month, year=year).exists():
            suggestion = f'Create the {today.strftime("%B")} payroll run to process salaries.'

        # 1. Monthly Trends (last 6 months)
        monthly_trends = []
        for i in range(5, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            
            run = PayrollRun.objects.filter(
                tenant=tenant, month=m, year=y, status__in=['processed', 'approved', 'paid']
            ).first()
            
            run_cost = Decimal('0')
            run_employees = 0
            if run:
                run_cost = PayrollItem.objects.filter(
                    payroll_run=run
                ).aggregate(total=Sum('net_pay'))['total'] or Decimal('0')
                run_employees = PayrollItem.objects.filter(payroll_run=run).count()
            
            month_label = date(y, m, 1).strftime("%b %Y")
            monthly_trends.append({
                'month': month_label,
                'cost': float(run_cost),
                'employees': run_employees
            })

        # 2. Department Costs Distribution (Active employees basic + allowances)
        active_employees = Employee.objects.filter(tenant=tenant, status='active')
        dept_map = {}
        for emp in active_employees:
            dept = emp.department or "General"
            if dept not in dept_map:
                dept_map[dept] = {"cost": Decimal('0'), "employees": 0}
            
            allowance_sum = Decimal('0')
            if isinstance(emp.allowances, dict):
                for val in emp.allowances.values():
                    try:
                        allowance_sum += Decimal(str(val))
                    except (ValueError, TypeError):
                        pass
            
            dept_map[dept]["cost"] += (emp.salary_basic + allowance_sum)
            dept_map[dept]["employees"] += 1
            
        department_costs = [
            {
                'department': dept,
                'cost': float(info["cost"]),
                'employees': info["employees"]
            }
            for dept, info in dept_map.items()
        ]

        # 3. Leave Distribution (Current year approved leaves by type)
        leaves = Leave.objects.filter(
            employee__tenant=tenant,
            status='approved',
            start_date__year=today.year
        )
        leave_map = {}
        for lv in leaves:
            ltype = lv.leave_type or "annual"
            days = (lv.end_date - lv.start_date).days + 1
            leave_map[ltype] = leave_map.get(ltype, 0) + days
            
        leave_distribution = [
            {
                'leave_type': ltype,
                'days': days
            }
            for ltype, days in leave_map.items()
        ]

        return Response({
            'total_employees': total_employees,
            'monthly_payroll_cost': float(monthly_payroll_cost),
            'pending_leaves': pending_leaves,
            'alerts': alerts,
            'attendance_rate': attendance_rate,
            'leave_utilization': leave_utilization,
            'suggestion': suggestion,
            'recent_activities': recent_activities,
            'company_name': tenant.name,
            'monthly_trends': monthly_trends,
            'department_costs': department_costs,
            'leave_distribution': leave_distribution,
        })


class AuditTrailView(APIView):
    """
    GET /api/audit-trail/
    Returns the 200 most-recent audit log entries for the requesting tenant.

    Query params:
        action   – filter by AuditAction (e.g. CREATE, PAYROLL_RUN)
        resource – filter by resource_type (e.g. Employee, PayrollRun)
        limit    – max rows (default 100, max 500)
    """
    permission_classes = (IsAuthenticated, IsHROrAdmin)

    def get(self, request):
        tenant, err = tenant_required(request)
        if err:
            return err

        qs = AuditLog.objects.filter(tenant=tenant).order_by('-timestamp')

        action_filter   = request.query_params.get('action')
        resource_filter = request.query_params.get('resource')
        if action_filter:
            qs = qs.filter(action=action_filter.upper())
        if resource_filter:
            qs = qs.filter(resource_type__iexact=resource_filter)

        try:
            limit = min(int(request.query_params.get('limit', 100)), 500)
        except (ValueError, TypeError):
            limit = 100

        entries = qs[:limit]

        data = [
            {
                'id':            str(entry.pk),
                'timestamp':     entry.timestamp.isoformat(),
                'action':        entry.action,
                'actor_email':   entry.actor_email or entry.actor_id,
                'resource_type': entry.resource_type,
                'resource_id':   entry.resource_id,
                'ip_address':    entry.ip_address,
            }
            for entry in entries
        ]
        return Response({'audit_logs': data, 'count': len(data)})

