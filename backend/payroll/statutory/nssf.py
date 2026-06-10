from decimal import Decimal, ROUND_HALF_UP

def clamp_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_nssf(gross_pay: Decimal) -> dict:
    """
    Calculates Tier I and Tier II NSSF contributions (6% statutory rate).
    Limits: LEL = 7,000, UEL = 36,000
    """
    lel = Decimal('7000.00')
    uel = Decimal('36000.00')
    rate = Decimal('0.06')

    # Tier 1: 6% of pay up to LEL (Max 420)
    tier_1_earnings = min(gross_pay, lel)
    tier_1_employee = tier_1_earnings * rate

    # Tier 2: 6% of pay between LEL and UEL (Max 1740)
    tier_2_earnings = max(Decimal('0.00'), min(gross_pay, uel) - lel)
    tier_2_employee = tier_2_earnings * rate

    total_nssf = tier_1_employee + tier_2_employee

    return {
        "tier_1": clamp_decimal(tier_1_employee),
        "tier_2": clamp_decimal(tier_2_employee),
        "total_employee": clamp_decimal(total_nssf),
        "total_employer": clamp_decimal(total_nssf)  # 1:1 Matching
    }
