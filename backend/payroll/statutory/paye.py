from decimal import Decimal, ROUND_HALF_UP

def clamp_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_paye(gross_pay: Decimal, nssf_deduction: Decimal, personal_relief: Decimal = Decimal('2400.00')) -> dict:
    """
    Calculates progressive KRA PAYE tax liabilities given taxable income.
    Applies standard monthly personal relief of KES 2,400.
    """
    taxable_pay = max(Decimal('0.00'), gross_pay - nssf_deduction)
    
    # Define progressive brackets: (limit, rate)
    brackets = [
        (Decimal('24000.00'), Decimal('0.10')),
        (Decimal('8333.00'), Decimal('0.25')),
        (Decimal('467667.00'), Decimal('0.30')),
        (Decimal('300000.00'), Decimal('0.325')),
        (Decimal('inf'), Decimal('0.35'))
    ]
    
    gross_paye = Decimal('0.00')
    remaining_pay = taxable_pay

    for limit, rate in brackets:
        if remaining_pay <= 0:
            break
        taxable_amount = min(remaining_pay, limit)
        gross_paye += taxable_amount * rate
        remaining_pay -= taxable_amount

    # Apply Personal Relief
    net_paye = max(Decimal('0.00'), gross_paye - personal_relief)

    return {
        "taxable_pay": clamp_decimal(taxable_pay),
        "gross_paye": clamp_decimal(gross_paye),
        "personal_relief": clamp_decimal(personal_relief),
        "net_paye": clamp_decimal(net_paye)
    }
