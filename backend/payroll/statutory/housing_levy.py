from decimal import Decimal, ROUND_HALF_UP

def clamp_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_housing_levy(gross_pay: Decimal) -> dict:
    """Affordable Housing Levy: 1.5% employee, 1.5% employer"""
    levy = clamp_decimal(gross_pay * Decimal('0.015'))
    return {
        "employee": levy,
        "employer": levy
    }
