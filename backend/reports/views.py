import calendar
import csv
from datetime import date, timedelta

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import views, permissions, status
from rest_framework.response import Response
from payroll.models import PayrollItem, PayrollRun
from attendance.models import Attendance
from employees.models import Employee
from leave.models import Leave
from core.permissions import IsHROrAdmin


class ReportGenerationView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsHROrAdmin]

    def _parse_range(self, request):
        range_str = request.data.get('range')
        today = timezone.now().date()

        if range_str is None:
            range_str = 'this_month'

        if range_str == 'last_30_days':
            return today - timedelta(days=29), today

        if range_str == 'current_quarter':
            quarter = (today.month - 1) // 3
            start_month = quarter * 3 + 1
            return date(today.year, start_month, 1), today

        if range_str == 'last_12_months':
            try:
                return today.replace(year=today.year - 1), today
            except ValueError:
                return date(today.year - 1, 2, 28), today

        if range_str == 'all_time':
            return None, None

        if range_str == 'this_month':
            return date(today.year, today.month, 1), today

        if range_str == 'last_month':
            if today.month == 1:
                month, year = 12, today.year - 1
            else:
                month, year = today.month - 1, today.year
            return date(year, month, 1), self._month_end(year, month)

        if range_str == 'this_year':
            return date(today.year, 1, 1), today

        if isinstance(range_str, str) and len(range_str) >= 7 and range_str[4] == '-':
            try:
                year = int(range_str[:4])
                month = int(range_str[5:7])
                return date(year, month, 1), self._month_end(year, month)
            except ValueError:
                pass

        supported = [
            'last_30_days',
            'current_quarter',
            'last_12_months',
            'all_time',
            'this_month',
            'last_month',
            'this_year',
            'YYYY-MM',
        ]
        raise ValueError(
            f"Unsupported range value {range_str!r}. Supported values are: {', '.join(supported)}."
        )

    def _month_end(self, year, month):
        return date(year, month, calendar.monthrange(year, month)[1])

    def _month_pairs(self, start_date, end_date):
        pairs = []
        current = date(start_date.year, start_date.month, 1)
        last_month = date(end_date.year, end_date.month, 1)
        while current <= last_month:
            pairs.append((current.year, current.month))
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)
        return pairs

    def _payroll_run_range_filter(self, start_date, end_date):
        if start_date is None or end_date is None:
            return Q()

        query = Q()
        for year, month in self._month_pairs(start_date, end_date):
            query |= Q(payroll_run__year=year, payroll_run__month=month)
        return query

    def post(self, request):
        report_type = request.data.get('type')

        if not report_type:
            return Response({"error": "Report type is required"}, status=status.HTTP_400_BAD_REQUEST)

        tenant = request.user.tenant
        try:
            start_date, end_date = self._parse_range(request)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if report_type == 'payroll_summary':
            return self.generate_payroll_summary(tenant, start_date, end_date)
        elif report_type == 'attendance_matrix':
            return self.generate_attendance_matrix(tenant, start_date, end_date)
        elif report_type == 'statutory_returns':
            return self.generate_statutory_returns(tenant, start_date, end_date)
        elif report_type == 'leave_utilization':
            return self.generate_leave_utilization(tenant, start_date, end_date)
        elif report_type == 'employee_turnover':
            return self.generate_employee_turnover(tenant, start_date, end_date)
        elif report_type == 'expense_tracking':
            return self.generate_expense_tracking(tenant, start_date, end_date)
        elif report_type == 'p9_annual':
            today = timezone.now().date()
            year_param = int(request.data.get('year', today.year))
            return self.generate_p9_annual(tenant, year_param)
        else:
            return Response({"error": "Unsupported report type"}, status=status.HTTP_400_BAD_REQUEST)

    def generate_payroll_summary(self, tenant, start_date, end_date):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="payroll_summary.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Employee', 'Month/Year', 'Gross Salary', 'PAYE', 'NSSF', 'SHIF', 'AHL', 'Net Pay'])
        
        items = PayrollItem.objects.filter(payroll_run__tenant=tenant)
        if start_date is not None and end_date is not None:
            items = items.filter(self._payroll_run_range_filter(start_date, end_date))
        items = items.order_by('employee__name')
        for item in items:
            writer.writerow([
                item.employee.name,
                f"{item.payroll_run.month}/{item.payroll_run.year}",
                item.gross_salary,
                item.paye,
                item.nssf,
                item.shif,
                item.ahl,
                item.net_pay
            ])
        
        return response

    def generate_attendance_matrix(self, tenant, start_date, end_date):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="attendance_matrix.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours Worked', 'Overtime'])
        
        attendances = Attendance.objects.filter(employee__tenant=tenant)
        if start_date is not None and end_date is not None:
            attendances = attendances.filter(date__range=(start_date, end_date))
        attendances = attendances.order_by('-date')
        for att in attendances:
            writer.writerow([
                att.employee.name,
                att.date,
                att.clock_in,
                att.clock_out,
                att.hours_worked,
                att.overtime_hours
            ])
        
        return response

    def generate_statutory_returns(self, tenant, start_date, end_date):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="statutory_returns.csv"'
        
        writer = csv.writer(response)
        # KRA iTax P10 Format Headers
        writer.writerow([
            'Employee PIN', 
            'Employee Name', 
            'Basic Salary', 
            'Allowances', 
            'Gross Pay', 
            'NSSF', 
            'SHIF', 
            'Taxable Pay', 
            'PAYE', 
            'Net Pay'
        ])
        
        from decimal import Decimal
        
        # Using processed payroll items
        items = PayrollItem.objects.filter(payroll_run__tenant=tenant, payroll_run__status__in=['processed', 'approved', 'paid'])
        if start_date is not None and end_date is not None:
            items = items.filter(self._payroll_run_range_filter(start_date, end_date))
        for item in items:
            # Safely calculate allowances from the employee JSONField
            allowances_total = sum(Decimal(str(v)) for v in item.employee.allowances.values()) if item.employee.allowances else Decimal('0.00')
            
            # Reconstruct Taxable Pay as per our fortified engine logic
            taxable_pay = max(item.gross_salary - item.nssf - item.shif - item.ahl, Decimal('0.00'))
            
            writer.writerow([
                getattr(item.employee, 'kra_pin', 'N/A'),
                item.employee.name,
                item.employee.salary_basic,
                allowances_total,
                item.gross_salary,
                item.nssf,
                item.shif,
                taxable_pay,
                item.paye,
                item.net_pay
            ])
        
        return response

    def generate_leave_utilization(self, tenant, start_date, end_date):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="leave_utilization.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Employee', 'Leave Type', 'Start Date', 'End Date', 'Status', 'Days'])
        
        leaves = Leave.objects.filter(employee__tenant=tenant)
        if start_date is not None and end_date is not None:
            leaves = leaves.filter(start_date__range=(start_date, end_date))
        leaves = leaves.order_by('-start_date')
        for lv in leaves:
            days = (lv.end_date - lv.start_date).days + 1
            writer.writerow([
                lv.employee.name,
                lv.get_leave_type_display(),
                lv.start_date,
                lv.end_date,
                lv.status,
                days
            ])
        
        return response

    def generate_employee_turnover(self, tenant, start_date=None, end_date=None):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="employee_turnover.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Employee', 'Hire Date', 'Termination Date', 'Status', 'Employment Type'])
        
        employees = Employee.objects.filter(tenant=tenant)
        if start_date is not None and end_date is not None:
            employees = employees.filter(
                Q(hire_date__range=(start_date, end_date)) |
                Q(termination_date__range=(start_date, end_date))
            )
        employees = employees.order_by('-hire_date')
        for emp in employees:
            writer.writerow([
                emp.name,
                emp.hire_date or 'N/A',
                emp.termination_date or 'N/A',
                emp.status,
                emp.get_employment_type_display()
            ])
        
        return response

    def generate_expense_tracking(self, tenant, start_date=None, end_date=None):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="expense_tracking.csv"'
        
        writer = csv.writer(response)
        # Using allowances and basic salary as proxy for recurring expenses
        writer.writerow(['Employee', 'Basic Salary', 'Allowances Breakdown', 'Total Monthly Cost'])
        
        employees = Employee.objects.filter(tenant=tenant, status='active')
        if start_date is not None and end_date is not None:
            employees = employees.filter(
                hire_date__lte=end_date,
            ).filter(
                Q(termination_date__gte=start_date) | Q(termination_date__isnull=True)
            )
        for emp in employees:
            allowances_str = "; ".join([f"{k}: {v}" for k, v in emp.allowances.items()])
            total_allowances = sum(emp.allowances.values()) if isinstance(emp.allowances, dict) else 0
            total_cost = emp.salary_basic + total_allowances
            
            writer.writerow([
                emp.name,
                emp.salary_basic,
                allowances_str or 'None',
                total_cost
            ])
        
        return response

    def generate_p9_annual(self, tenant, year):
        """
        Generates the KRA P9 Annual Tax Deduction Card in CSV format.
        Aggregates all processed PayrollItems across all 12 months for the given year.
        One row per employee with monthly PAYE columns + annual totals.
        """
        from decimal import Decimal
        from django.db.models import Sum

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="p9_annual_{year}.csv"'

        writer = csv.writer(response)

        # KRA P9 header format
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        header = ['KRA PIN', 'Employee Name', 'Basic Pay (Annual)']
        header += [f'PAYE {m}' for m in month_names]
        header += ['Annual PAYE', 'Annual NSSF', 'Annual SHIF', 'Annual AHL', 'Annual Net Pay']
        writer.writerow(header)

        employees = Employee.objects.filter(tenant=tenant).order_by('name')
        for emp in employees:
            row = [
                getattr(emp, 'kra_pin', 'N/A') or 'N/A',
                emp.name,
                float(emp.salary_basic) * 12,
            ]

            annual_paye = Decimal('0')
            annual_nssf = Decimal('0')
            annual_shif = Decimal('0')
            annual_ahl  = Decimal('0')
            annual_net  = Decimal('0')

            for m in range(1, 13):
                item = PayrollItem.objects.filter(
                    employee=emp,
                    payroll_run__tenant=tenant,
                    payroll_run__year=year,
                    payroll_run__month=m,
                    payroll_run__status__in=['processed', 'approved', 'paid'],
                ).first()

                if item:
                    row.append(float(item.paye))
                    annual_paye += item.paye
                    annual_nssf += item.nssf
                    annual_shif += item.shif
                    annual_ahl  += item.ahl
                    annual_net  += item.net_pay
                else:
                    row.append(0.00)

            row += [
                float(annual_paye),
                float(annual_nssf),
                float(annual_shif),
                float(annual_ahl),
                float(annual_net),
            ]
            writer.writerow(row)

        return response


class P9AnnualView(views.APIView):
    """
    Dedicated GET endpoint for P9 Annual Tax Form generation.
    Accepts: ?year=2025
    """
    permission_classes = [permissions.IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        tenant = request.user.tenant
        year = int(request.query_params.get('year', date.today().year))
        report_view = ReportGenerationView()
        return report_view.generate_p9_annual(tenant, year)
