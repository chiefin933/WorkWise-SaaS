from decimal import Decimal, ROUND_HALF_UP


def clamp_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_nssf_new_act(
    gross_pay: Decimal,
    lel: Decimal = Decimal('7000.00'),
    uel: Decimal = Decimal('36000.00'),
    rate: Decimal = Decimal('0.06'),
) -> dict:
    """
    New NSSF Act 2013 — Tier I + Tier II contributions.
    Tier I: 6% of earnings up to LEL (max KES 420 employee, KES 420 employer)
    Tier II: 6% of earnings between LEL and UEL (max KES 1,740 employee + employer)
    Both employee and employer contribute equally (1:1 matching).
    LEL and UEL are configurable.
    """
    tier_1_earnings  = min(gross_pay, lel)
    tier_1_employee  = clamp_decimal(tier_1_earnings * rate)

    tier_2_earnings  = max(Decimal('0.00'), min(gross_pay, uel) - lel)
    tier_2_employee  = clamp_decimal(tier_2_earnings * rate)

    total_employee   = clamp_decimal(tier_1_employee + tier_2_employee)

    return {
        'act':            'new',
        'tier_1':         tier_1_employee,
        'tier_2':         tier_2_employee,
        'total_employee': total_employee,
        'total_employer': total_employee,   # employer matches 1:1
    }


def calculate_nssf_old_act() -> dict:
    """
    Old NSSF Act (pre-2013) — flat KES 200 employee / KES 200 employer.
    Still used by some companies pending court resolution of the new Act.
    """
    flat = Decimal('200.00')
    return {
        'act':            'old',
        'tier_1':         flat,
        'tier_2':         Decimal('0.00'),
        'total_employee': flat,
        'total_employer': flat,
    }


def calculate_nssf(
    gross_pay: Decimal,
    act: str = 'new',
    lel: Decimal = Decimal('7000.00'),
    uel: Decimal = Decimal('36000.00'),
    rate: Decimal = Decimal('0.06'),
) -> dict:
    """
    Dispatcher: choose between old and new NSSF Act based on PayrollConfig.nssf_act.
    Default is 'new' (NSSF Act 2013 Tier I + Tier II).
    Set act='old' for companies using the flat KES 200 contribution.
    """
    if act == 'old':
        return calculate_nssf_old_act()
    return calculate_nssf_new_act(gross_pay, lel=lel, uel=uel, rate=rate)
