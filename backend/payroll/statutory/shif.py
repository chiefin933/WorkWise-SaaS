from decimal import Decimal, ROUND_HALF_UP

def clamp_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_shif(gross_pay: Decimal) -> Decimal:
    """SHIF Levy: Flat 2.75% of Gross Pay"""
    return clamp_decimal(gross_pay * Decimal('0.0275'))
