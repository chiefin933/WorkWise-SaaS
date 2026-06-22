"""
payroll/statutory/engines.py
-----------------------------
KenyaStatutoryEngine — coordinates all statutory deductions using rates
sourced from PayrollConfig. All calculations use Python Decimal with
ROUND_HALF_UP for compliance.

Previously, this engine ignored PayrollConfig rates and used hardcoded
values. This version passes all configurable rates from PayrollConfig
into each sub-calculator so company-specific overrides are respected.
"""

from decimal import Decimal
from .nssf import calculate_nssf, clamp_decimal
from .shif import calculate_shif
from .housing_levy import calculate_housing_levy
from .paye import calculate_paye


class KenyaStatutoryEngine:
    """
    Computes a complete statutory payslip for a Kenyan employee.

    All rates are read from the PayrollConfig passed in:
      - nssf_act:       'new' (NSSF Act 2013 Tier I+II) or 'old' (flat KES 200)
      - nssf_rate:      NSSF contribution rate (default 6%)
      - nssf_lel:       NSSF Lower Earnings Limit (default KES 7,000)
      - nssf_uel:       NSSF Upper Earnings Limit (default KES 36,000)
      - shif_rate:      SHIF rate (default 2.75%)
      - shif_min:       SHIF minimum (default KES 300)
      - ahl_rate:       Housing Levy rate (default 1.5%)
      - personal_relief PAYE personal relief (default KES 2,400/month)
      - paye_bands:     List of {limit, rate} dicts for progressive PAYE
    """

    # Statutory defaults — used when PayrollConfig is absent or fields are blank
    DEFAULT_PERSONAL_RELIEF = Decimal('2400.00')
    DEFAULT_NSSF_RATE        = Decimal('0.06')
    DEFAULT_NSSF_LEL         = Decimal('7000.00')
    DEFAULT_NSSF_UEL         = Decimal('36000.00')
    DEFAULT_SHIF_RATE        = Decimal('0.0275')
    DEFAULT_SHIF_MIN         = Decimal('300.00')
    DEFAULT_AHL_RATE         = Decimal('0.015')
    DEFAULT_PAYE_BANDS = [
        {'limit': 24000,   'rate': 0.10},
        {'limit': 8333,    'rate': 0.25},
        {'limit': 467667,  'rate': 0.30},
        {'limit': 300000,  'rate': 0.325},
        {'limit': float('inf'), 'rate': 0.35},
    ]

    @classmethod
    def _d(cls, value, default: Decimal) -> Decimal:
        """Safely convert config value to Decimal, falling back to default."""
        try:
            if value is None or value == '' or value == 0:
                return default
            return Decimal(str(value))
        except Exception:
            return default

    @classmethod
    def compute_payslip(cls, gross_pay: float | Decimal, config=None) -> dict:
        """
        Compute complete statutory deductions for gross_pay.
        All rates are sourced from config (PayrollConfig) where available.
        """
        gross = Decimal(str(gross_pay))

        # ── Read config values ────────────────────────────────────────────────
        nssf_act        = getattr(config, 'nssf_act', 'new') or 'new'
        nssf_rate       = cls._d(getattr(config, 'nssf_rate', None), cls.DEFAULT_NSSF_RATE)
        nssf_lel        = cls._d(getattr(config, 'nssf_lel', None), cls.DEFAULT_NSSF_LEL)
        nssf_uel        = cls._d(getattr(config, 'nssf_uel', None), cls.DEFAULT_NSSF_UEL)
        shif_rate       = cls._d(getattr(config, 'shif_rate', None), cls.DEFAULT_SHIF_RATE)
        shif_min        = cls._d(getattr(config, 'shif_min', None), cls.DEFAULT_SHIF_MIN)
        ahl_rate        = cls._d(getattr(config, 'ahl_rate', None), cls.DEFAULT_AHL_RATE)
        personal_relief = cls._d(getattr(config, 'personal_relief', None), cls.DEFAULT_PERSONAL_RELIEF)
        paye_bands      = (getattr(config, 'paye_bands', None) or []) or cls.DEFAULT_PAYE_BANDS

        # ── NSSF (old or new act, fully configurable) ─────────────────────────
        nssf_data = calculate_nssf(
            gross,
            act=nssf_act,
            lel=nssf_lel,
            uel=nssf_uel,
            rate=nssf_rate,
        )

        # ── SHIF (2.75% with KES 300 minimum — both configurable) ────────────
        shif_deduction = calculate_shif(gross, rate=shif_rate, minimum=shif_min)

        # ── Housing Levy / AHL (1.5% employee + 1.5% employer) ───────────────
        housing_levy_data = calculate_housing_levy(gross, rate=ahl_rate)

        # ── PAYE (progressive, config bands, personal relief) ─────────────────
        paye_data = calculate_paye(
            gross,
            nssf_data['total_employee'],
            personal_relief=personal_relief,
            bands=paye_bands,
        )

        # ── Totals ────────────────────────────────────────────────────────────
        total_deductions = (
            nssf_data['total_employee'] +
            paye_data['net_paye'] +
            shif_deduction +
            housing_levy_data['employee']
        )
        net_pay = gross - total_deductions

        return {
            'gross_pay':        clamp_decimal(gross),
            'nssf':             nssf_data,
            'paye':             paye_data,
            'shif':             shif_deduction,
            'housing_levy':     housing_levy_data,
            'total_deductions': clamp_decimal(total_deductions),
            'net_pay':          clamp_decimal(net_pay),
        }
