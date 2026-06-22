from decimal import Decimal, ROUND_HALF_UP


def clamp_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_housing_levy(
    gross_pay: Decimal,
    rate: Decimal = Decimal('0.015'),
) -> dict:
    """
    Affordable Housing Levy (AHL).
    Rate: 1.5% employee + 1.5% employer (default, configurable).
    Both employee and employer contribute the same amount.
    """
    levy = clamp_decimal(gross_pay * rate)
    return {
        'employee': levy,
        'employer': levy,
    }
