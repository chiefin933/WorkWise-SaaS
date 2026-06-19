"""
StatutoryExporter — generates government-filing CSV exports for a PayrollRun.

Exports:
  - PAYE  (KRA iTax)
  - NSSF  (NSSF Portal)
  - SHIF  (SHA Portal)
  - AHL   (Housing Levy Portal)

All methods return a StreamingHttpResponse so large payrolls stream to the
browser without buffering the entire CSV in memory.
"""
import io
import csv
from decimal import Decimal, ROUND_HALF_UP

from django.http import StreamingHttpResponse

from .models import PayrollItem, PayrollRun


class StatutoryExporter:

    # ── Internal helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _compute_nssf_tiers(gross: Decimal) -> dict:
        """
        Compute NSSF Tier I and Tier II contributions from gross pay.

        Tier I:  6 % of the first KES 7,000  (capped at KES 420.00)
        Tier II: 6 % of the band KES 7,001 – 36,000  (capped at KES 1,740.00)
        """
        two_dp = Decimal('0.01')
        tier1 = min(
            min(gross, Decimal('7000')) * Decimal('0.06'),
            Decimal('420.00'),
        ).quantize(two_dp, rounding=ROUND_HALF_UP)

        tier2 = min(
            max(Decimal('0'), min(gross, Decimal('36000')) - Decimal('7000')) * Decimal('0.06'),
            Decimal('1740.00'),
        ).quantize(two_dp, rounding=ROUND_HALF_UP)

        total = (tier1 + tier2).quantize(two_dp, rounding=ROUND_HALF_UP)

        return {'tier1': tier1, 'tier2': tier2, 'total': total}

    @staticmethod
    def _csv_streaming_response(rows, prefix: str, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        Build a StreamingHttpResponse that writes *rows* (an iterable of lists)
        as CSV.  Each row is flushed individually so memory stays constant.

        Filename format: {prefix}_{payroll_run.id}_{MM-YYYY}.csv
        """
        filename = (
            f"{prefix}_{payroll_run.id}_{payroll_run.month:02d}-{payroll_run.year}.csv"
        )

        def _generate():
            buf = io.StringIO()
            writer = csv.writer(buf)
            for row in rows:
                buf.seek(0)
                buf.truncate(0)
                writer.writerow(row)
                yield buf.getvalue()

        response = StreamingHttpResponse(_generate(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    # ── Public export methods ──────────────────────────────────────────────────

    def export_paye(self, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        PAYE export for KRA iTax monthly income tax returns.

        Header: PIN of Employee, Employee Name, Gross Pay, NSSF, SHIF,
                Housing Levy, PAYE, Net Pay, Period

        Employees with a non-empty KRA PIN are sorted first (ascending),
        employees without a PIN appear last.
        """
        period = f"{payroll_run.month:02d}-{payroll_run.year}"

        items = (
            PayrollItem.objects
            .filter(payroll_run=payroll_run)
            .select_related('employee')
        )

        # Sort: non-empty PIN first, empty last; within each group sort by name
        def _sort_key(item):
            pin = item.employee.kra_pin or ''
            return (0 if pin else 1, pin, item.employee.name)

        sorted_items = sorted(items, key=_sort_key)

        def _rows():
            yield [
                'PIN of Employee', 'Employee Name', 'Gross Pay',
                'NSSF', 'SHIF', 'Housing Levy', 'PAYE', 'Net Pay', 'Period',
            ]
            for item in sorted_items:
                pin = item.employee.kra_pin or ''
                yield [
                    pin,
                    item.employee.name,
                    f"{item.gross_salary:.2f}",
                    f"{item.nssf:.2f}",
                    f"{item.shif:.2f}",
                    f"{item.ahl:.2f}",
                    f"{item.paye:.2f}",
                    f"{item.net_pay:.2f}",
                    period,
                ]

        return self._csv_streaming_response(_rows(), 'paye', payroll_run)

    def export_nssf(self, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        NSSF export for the NSSF Portal monthly pension contributions.

        Header: NSSF Number, Employee Name, PIN, Gross Earnings,
                Tier 1 Contribution, Tier 2 Contribution,
                Total Employee Contribution, Employer Contribution, Period

        Tiers are *recomputed* from gross_salary using _compute_nssf_tiers()
        rather than relying on the stored nssf field (which only holds the total).
        Employer contribution equals total employee contribution.
        """
        period = f"{payroll_run.month:02d}-{payroll_run.year}"

        items = (
            PayrollItem.objects
            .filter(payroll_run=payroll_run)
            .select_related('employee')
        )

        def _rows():
            yield [
                'NSSF Number', 'Employee Name', 'PIN', 'Gross Earnings',
                'Tier 1 Contribution', 'Tier 2 Contribution',
                'Total Employee Contribution', 'Employer Contribution', 'Period',
            ]
            for item in items:
                tiers = self._compute_nssf_tiers(item.gross_salary)
                nssf_number = getattr(item.employee, 'nssf_number', '') or ''
                pin = item.employee.kra_pin or ''
                employer = tiers['total']
                yield [
                    nssf_number,
                    item.employee.name,
                    pin,
                    f"{item.gross_salary:.2f}",
                    f"{tiers['tier1']:.2f}",
                    f"{tiers['tier2']:.2f}",
                    f"{tiers['total']:.2f}",
                    f"{employer:.2f}",
                    period,
                ]

        return self._csv_streaming_response(_rows(), 'nssf', payroll_run)

    def export_shif(self, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        SHIF export for the SHA Portal monthly health insurance levy.

        Header: Employee Name, ID Number (PIN), Gross Salary,
                SHIF Deduction, Month, Year

        SHIF Deduction enforces a minimum floor of KES 300.00.
        Month and Year are written as plain integers.
        """
        items = (
            PayrollItem.objects
            .filter(payroll_run=payroll_run)
            .select_related('employee')
        )

        def _rows():
            yield ['Employee Name', 'ID Number (PIN)', 'Gross Salary',
                   'SHIF Deduction', 'Month', 'Year']
            for item in items:
                pin = item.employee.kra_pin or ''
                shif = max(item.shif, Decimal('300.00'))
                yield [
                    item.employee.name,
                    pin,
                    f"{item.gross_salary:.2f}",
                    f"{shif:.2f}",
                    payroll_run.month,
                    payroll_run.year,
                ]

        return self._csv_streaming_response(_rows(), 'shif', payroll_run)

    def export_ahl(self, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        AHL export for the Housing Levy Portal.

        Header: Employee Name, PIN, Gross Pay,
                Employee AHL, Employer AHL, Total AHL, Period

        Employee AHL = gross_salary × 1.5 %  (rounded to 2 dp)
        Employer AHL = Employee AHL
        Total AHL    = Employee AHL + Employer AHL
        """
        period = f"{payroll_run.month:02d}-{payroll_run.year}"
        two_dp = Decimal('0.01')

        items = (
            PayrollItem.objects
            .filter(payroll_run=payroll_run)
            .select_related('employee')
        )

        def _rows():
            yield ['Employee Name', 'PIN', 'Gross Pay',
                   'Employee AHL', 'Employer AHL', 'Total AHL', 'Period']
            for item in items:
                pin = item.employee.kra_pin or ''
                emp_ahl = (item.gross_salary * Decimal('0.015')).quantize(
                    two_dp, rounding=ROUND_HALF_UP
                )
                employer_ahl = emp_ahl
                total_ahl = (emp_ahl + employer_ahl).quantize(
                    two_dp, rounding=ROUND_HALF_UP
                )
                yield [
                    item.employee.name,
                    pin,
                    f"{item.gross_salary:.2f}",
                    f"{emp_ahl:.2f}",
                    f"{employer_ahl:.2f}",
                    f"{total_ahl:.2f}",
                    period,
                ]

        return self._csv_streaming_response(_rows(), 'ahl', payroll_run)
