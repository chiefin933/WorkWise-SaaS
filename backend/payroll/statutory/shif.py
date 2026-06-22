from decimal import Decimal, ROUND_HALF_UP


def clamp_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_shif(
    gross_pay: Decimal,
    rate: Decimal = Decimal('0.0275'),
    minimum: Decimal = Decimal('300.00'),
) -> Decimal:
    """
    SHIF (Social Health Insurance Fund) deduction.
    Rate: 2.75% of gross pay.
    Minimum: KES 300 per month (enforced — never deduct less than this).
    Both rate and minimum are configurable via PayrollConfig.
    """
    computed = clamp_decimal(gross_pay * rate)
    return max(computed, clamp_decimal(minimum))
