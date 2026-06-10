from decimal import Decimal
from .nssf import calculate_nssf, clamp_decimal
from .shif import calculate_shif
from .housing_levy import calculate_housing_levy
from .paye import calculate_paye

class KenyaStatutoryEngine:
    PERSONAL_RELIEF = Decimal('2400.00')

    @classmethod
    def compute_payslip(cls, gross_pay: float | Decimal, config=None) -> dict:
        """Coordinates calculations to build a complete statutory payload"""
        gross = Decimal(str(gross_pay))
        
        # Determine personal relief from optional configuration
        personal_relief = cls.PERSONAL_RELIEF
        if config and hasattr(config, 'personal_relief') and config.personal_relief:
            personal_relief = Decimal(str(config.personal_relief))

        nssf_data = calculate_nssf(gross)
        paye_data = calculate_paye(gross, nssf_data["total_employee"], personal_relief=personal_relief)
        shif_deduction = calculate_shif(gross)
        housing_levy_data = calculate_housing_levy(gross)

        total_deductions = (
            nssf_data["total_employee"] + 
            paye_data["net_paye"] + 
            shif_deduction + 
            housing_levy_data["employee"]
        )
        net_pay = gross - total_deductions

        return {
            "gross_pay": clamp_decimal(gross),
            "nssf": nssf_data,
            "paye": paye_data,
            "shif": shif_deduction,
            "housing_levy": housing_levy_data,
            "total_deductions": clamp_decimal(total_deductions),
            "net_pay": clamp_decimal(net_pay)
        }
