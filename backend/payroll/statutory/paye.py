from decimal import Decimal, ROUND_HALF_UP
from typing import Optional


def clamp_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# KRA 2024/2025 default monthly PAYE bands
DEFAULT_PAYE_BANDS = [
    {'limit': 24000,        'rate': 0.10},
    {'limit': 8333,         'rate': 0.25},
    {'limit': 467667,       'rate': 0.30},
    {'limit': 300000,       'rate': 0.325},
    {'limit': float('inf'), 'rate': 0.35},
]


def calculate_paye(
    gross_pay: Decimal,
    nssf_deduction: Decimal,
    personal_relief: Decimal = Decimal('2400.00'),
    bands: Optional[list] = None,
) -> dict:
    """
    Calculates progressive KRA PAYE tax.

    Taxable income = gross pay − NSSF employee contribution.
    Applies configurable progressive tax bands (defaults to KRA 2024/2025 bands).
    Personal relief of KES 2,400/month is applied after band calculation.

    bands format: [{"limit": 24000, "rate": 0.10}, ...]
    The last band should have limit=Infinity (float('inf') or a very large number).
    """
    if not bands:
        bands = DEFAULT_PAYE_BANDS

    taxable_pay  = max(Decimal('0.00'), gross_pay - nssf_deduction)
    gross_paye   = Decimal('0.00')
    remaining    = taxable_pay

    for band in bands:
        if remaining <= 0:
            break
        limit = band.get('limit', float('inf'))
        rate  = Decimal(str(band['rate']))

        if limit in (float('inf'), None) or limit >= 1_000_000_000:
            taxable_amount = remaining
        else:
            taxable_amount = min(remaining, Decimal(str(limit)))

        gross_paye += taxable_amount * rate
        remaining  -= taxable_amount

    # Apply personal relief
    net_paye = max(Decimal('0.00'), gross_paye - personal_relief)

    return {
        'taxable_pay':    clamp_decimal(taxable_pay),
        'gross_paye':     clamp_decimal(gross_paye),
        'personal_relief': clamp_decimal(personal_relief),
        'net_paye':       clamp_decimal(net_paye),
    }
