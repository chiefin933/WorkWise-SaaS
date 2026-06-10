from decimal import Decimal
from django.test import TestCase
from payroll.statutory.nssf import calculate_nssf
from payroll.statutory.shif import calculate_shif
from payroll.statutory.housing_levy import calculate_housing_levy
from payroll.statutory.paye import calculate_paye
from payroll.statutory.engines import KenyaStatutoryEngine


class KenyaStatutoryEngineTests(TestCase):
    """
    Test suite for verifying the correctness of individual statutory calculations
    and the consolidated payslip output under various income levels.
    """

    def test_nssf_calculation_below_lel(self):
        # Gross pay of 5,000 is below LEL (7,000)
        res = calculate_nssf(Decimal('5000.00'))
        self.assertEqual(res['tier_1'], Decimal('300.00'))  # 6% of 5000
        self.assertEqual(res['tier_2'], Decimal('0.00'))
        self.assertEqual(res['total_employee'], Decimal('300.00'))
        self.assertEqual(res['total_employer'], Decimal('300.00'))

    def test_nssf_calculation_between_lel_and_uel(self):
        # Gross pay of 20,000 is between LEL (7,000) and UEL (36,000)
        res = calculate_nssf(Decimal('20000.00'))
        self.assertEqual(res['tier_1'], Decimal('420.00'))  # 6% of 7000 (Max cap)
        self.assertEqual(res['tier_2'], Decimal('780.00'))  # 6% of (20000 - 7000)
        self.assertEqual(res['total_employee'], Decimal('1200.00'))
        self.assertEqual(res['total_employer'], Decimal('1200.00'))

    def test_nssf_calculation_above_uel(self):
        # Gross pay of 50,000 is above UEL (36,000)
        res = calculate_nssf(Decimal('50000.00'))
        self.assertEqual(res['tier_1'], Decimal('420.00'))  # Max cap
        self.assertEqual(res['tier_2'], Decimal('1740.00'))  # Max cap
        self.assertEqual(res['total_employee'], Decimal('2160.00'))
        self.assertEqual(res['total_employer'], Decimal('2160.00'))

    def test_shif_calculation(self):
        # Flat 2.75% of Gross
        self.assertEqual(calculate_shif(Decimal('100000.00')), Decimal('2750.00'))
        self.assertEqual(calculate_shif(Decimal('10000.00')), Decimal('275.00'))

    def test_housing_levy_calculation(self):
        # Flat 1.5% for employee and employer
        res = calculate_housing_levy(Decimal('100000.00'))
        self.assertEqual(res['employee'], Decimal('1500.00'))
        self.assertEqual(res['employer'], Decimal('1500.00'))

    def test_paye_calculation_low_income(self):
        # Gross pay of 20,000 -> Taxable pay of 20,000 (assuming no NSSF for raw calculation test)
        # First 24,000 @ 10% -> 2,000 gross tax. Net PAYE = 2000 - 2400 (relief) -> 0.00
        res = calculate_paye(Decimal('20000.00'), Decimal('0.00'))
        self.assertEqual(res['taxable_pay'], Decimal('20000.00'))
        self.assertEqual(res['gross_paye'], Decimal('2000.00'))
        self.assertEqual(res['net_paye'], Decimal('0.00'))

    def test_paye_calculation_standard_income(self):
        # Gross pay of 100,000 -> assume NSSF is 2,160 -> Taxable pay = 97,840.00
        # First 24,000 @ 10% = 2,400.00
        # Next 8,333 @ 25% = 2,083.25
        # Next 65,507 @ 30% = 19,652.10
        # Gross PAYE = 24,135.35
        # Net PAYE = 24,135.35 - 2,400 (relief) = 21,735.35
        res = calculate_paye(Decimal('100000.00'), Decimal('2160.00'))
        self.assertEqual(res['taxable_pay'], Decimal('97840.00'))
        self.assertEqual(res['gross_paye'], Decimal('24135.35'))
        self.assertEqual(res['net_paye'], Decimal('21735.35'))

    def test_consolidated_payslip_calculation(self):
        # Verify complete coordinated payslip logic for KES 100,000
        payslip = KenyaStatutoryEngine.compute_payslip(Decimal('100000.00'))
        self.assertEqual(payslip['gross_pay'], Decimal('100000.00'))
        self.assertEqual(payslip['nssf']['total_employee'], Decimal('2160.00'))
        self.assertEqual(payslip['paye']['taxable_pay'], Decimal('97840.00'))
        self.assertEqual(payslip['paye']['net_paye'], Decimal('21735.35'))
        self.assertEqual(payslip['shif'], Decimal('2750.00'))
        self.assertEqual(payslip['housing_levy']['employee'], Decimal('1500.00'))
        self.assertEqual(payslip['total_deductions'], Decimal('28145.35'))
        self.assertEqual(payslip['net_pay'], Decimal('71854.65'))
