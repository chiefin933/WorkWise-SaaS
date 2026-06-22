import math
from decimal import Decimal
from attendance.models import Attendance
from .models import PayrollConfig
from .statutory.engines import KenyaStatutoryEngine

class PayrollEngine:
    def __init__(self, config: PayrollConfig):
        self.config = config

    def normalize_salary(self, employee, month, year):
        # In a real app, query attendance for the month/year
        # For simplicity in engine logic, we assume we pass aggregated days/hours
        
        # We need a way to get total hours/days. We'll abstract this for the engine core.
        # Let's assume we pass in total_days_worked, total_hours_worked for the month.
        pass # implemented in calculate_item

    def compute_gross(self, base_salary, allowances_total, overtime_pay, unpaid_leave_deduction):
        return base_salary + allowances_total + overtime_pay - unpaid_leave_deduction

    def compute_nssf(self, gross: Decimal):
        rate = Decimal(str(self.config.nssf_rate)) if self.config.nssf_rate else Decimal('0.06')
        cap = Decimal(str(self.config.nssf_cap)) if self.config.nssf_cap else Decimal('2160.00')
        return min(gross * rate, cap)

    def compute_shif(self, gross: Decimal):
        rate = Decimal(str(self.config.shif_rate)) if self.config.shif_rate else Decimal('0.0275')
        minimum = Decimal(str(self.config.shif_min)) if self.config.shif_min else Decimal('300.00')
        return max(gross * rate, minimum)

    def compute_ahl(self, gross: Decimal):
        rate = Decimal(str(self.config.ahl_rate)) if self.config.ahl_rate else Decimal('0.015')
        return gross * rate

    def calculate_paye(self, taxable: Decimal):
        bands = self.config.paye_bands
        if not bands:
            # Default KRA fallback bands
            bands = [
                {"limit": 24000, "rate": 0.10},
                {"limit": 8333, "rate": 0.25},
                {"limit": 467667, "rate": 0.30},
                {"limit": 300000, "rate": 0.325},
                {"limit": float('inf'), "rate": 0.35}
            ]
        
        tax = Decimal('0.00')
        remaining = taxable

        for band in bands:
            limit = Decimal(str(band['limit']))
            rate = Decimal(str(band['rate']))
            
            amount = min(remaining, limit) if limit != float('inf') else remaining
            tax += amount * rate
            remaining -= amount
            if remaining <= Decimal('0.00'):
                break

        return tax

    def calculate_employee_payroll(self, employee, aggregated_attendance):
        """
        aggregated_attendance expects:
        { 'days_worked': X, 'hours_worked': Y, 'overtime_hours': Z }
        """
        # 1. Normalize Salary
        base = Decimal(str(employee.salary_basic))
        if employee.employment_type == 'monthly':
            salary = base
        elif employee.employment_type == 'weekly':
            salary = base * 4
        elif employee.employment_type == 'daily':
            salary = base * Decimal(str(aggregated_attendance.get('days_worked', 0)))
        elif employee.employment_type == 'hourly':
            salary = base * Decimal(str(aggregated_attendance.get('hours_worked', 0)))
        else:
            salary = base

        # Allowances
        allowances_total = sum(Decimal(str(v)) for v in employee.allowances.values()) if employee.allowances else Decimal('0.00')
        
        # Overtime — Kenya Employment Act rates:
        # 1.5x for weekday overtime, 2.0x for Sunday and public holiday overtime
        # The payroll task passes aggregated overtime split by type:
        #   'overtime_hours'            → weekday overtime (1.5x)
        #   'public_holiday_overtime_hours' → Sunday/public holiday overtime (2.0x)
        hourly_rate = salary / Decimal('160') if employee.employment_type == 'monthly' else base
        weekday_overtime  = Decimal(str(aggregated_attendance.get('overtime_hours', 0)))
        holiday_overtime  = Decimal(str(aggregated_attendance.get('public_holiday_overtime_hours', 0)))
        overtime_pay = (weekday_overtime * hourly_rate * Decimal('1.5')) + \
                       (holiday_overtime * hourly_rate * Decimal('2.0'))
        
        # Unpaid Leave
        unpaid_leave_days = Decimal(str(aggregated_attendance.get('unpaid_leave_days', 0)))
        if employee.employment_type == 'monthly':
            unpaid_deduction = (base / Decimal('30')) * unpaid_leave_days
        elif employee.employment_type == 'weekly':
            unpaid_deduction = (base / Decimal('6')) * unpaid_leave_days
        else:
            unpaid_deduction = base * unpaid_leave_days

        # 2. Gross Salary
        gross = self.compute_gross(salary, allowances_total, overtime_pay, unpaid_deduction)

        # 3. Compute statutory calculations using the new engine
        statutory = KenyaStatutoryEngine.compute_payslip(gross, self.config)

        return {
            'gross_salary': statutory['gross_pay'],
            'nssf': statutory['nssf']['total_employee'],
            'shif': statutory['shif'],
            'ahl': statutory['housing_levy']['employee'],
            'taxable_income': statutory['paye']['taxable_pay'],
            'paye': statutory['paye']['net_paye'],
            'net_pay': statutory['net_pay'],
        }
