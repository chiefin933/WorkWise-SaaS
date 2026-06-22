"""
core/kenya_holidays.py
----------------------
Kenya Public Holiday Calendar.

Kenya has 12 statutory public holidays under the Public Holidays Act (Cap 110).
These affect:
  - Payroll: overtime on public holidays = 2x (vs 1.5x on weekdays)
  - Attendance: flag clock-ins as public holiday
  - Leave: public holidays don't count as leave days

Usage:
    from core.kenya_holidays import is_public_holiday, get_holidays_in_month

    is_public_holiday(date(2026, 1, 1))   # True (New Year's Day)
    get_holidays_in_month(2026, 12)        # [date(2026, 12, 12), date(2026, 12, 25), date(2026, 12, 26)]
"""

import datetime
from typing import Optional


# Fixed-date public holidays (month, day) — observed every year
FIXED_HOLIDAYS = {
    (1, 1):   "New Year's Day",
    (5, 1):   "Labour Day",
    (6, 1):   "Madaraka Day",
    (10, 10): "Huduma Day",
    (10, 20): "Mashujaa Day",
    (12, 12): "Jamhuri Day",
    (12, 25): "Christmas Day",
    (12, 26): "Boxing Day",
}

# Variable-date holidays (computed per year)
# Easter-based holidays vary — computed from Easter Sunday
# Idd-ul-Fitr and Idd-ul-Adha vary by Islamic calendar
# The system stores them as overrides in VARIABLE_HOLIDAY_OVERRIDES

# Known variable holiday dates (extend as needed)
VARIABLE_HOLIDAY_OVERRIDES: dict[int, list[tuple[int, int, str]]] = {
    2024: [
        (3, 29, "Good Friday"),
        (4,  1, "Easter Monday"),
        (4, 10, "Idd-ul-Fitr"),
        (6, 16, "Idd-ul-Adha"),
    ],
    2025: [
        (4, 18, "Good Friday"),
        (4, 21, "Easter Monday"),
        (3, 30, "Idd-ul-Fitr"),
        (6,  6, "Idd-ul-Adha"),
    ],
    2026: [
        (4,  3, "Good Friday"),
        (4,  6, "Easter Monday"),
        (3, 20, "Idd-ul-Fitr"),
        (5, 27, "Idd-ul-Adha"),
    ],
    2027: [
        (3, 26, "Good Friday"),
        (3, 29, "Easter Monday"),
        (3,  9, "Idd-ul-Fitr"),
        (5, 16, "Idd-ul-Adha"),
    ],
}


def get_holidays_for_year(year: int) -> dict[datetime.date, str]:
    """
    Return a dict of {date: holiday_name} for all public holidays in the given year.
    Includes both fixed and variable (Easter, Idd) holidays.
    """
    holidays: dict[datetime.date, str] = {}

    # Fixed holidays
    for (month, day), name in FIXED_HOLIDAYS.items():
        try:
            holidays[datetime.date(year, month, day)] = name
        except ValueError:
            pass  # Skip invalid dates (shouldn't happen with fixed list)

    # Variable holidays
    for month, day, name in VARIABLE_HOLIDAY_OVERRIDES.get(year, []):
        try:
            holidays[datetime.date(year, month, day)] = name
        except ValueError:
            pass

    # If a holiday falls on Sunday, the following Monday is observed
    adjusted: dict[datetime.date, str] = {}
    for date, name in holidays.items():
        if date.weekday() == 6:  # Sunday
            observed = date + datetime.timedelta(days=1)
            adjusted[observed] = f"{name} (Observed)"
        else:
            adjusted[date] = name

    return adjusted


def is_public_holiday(date: datetime.date) -> bool:
    """Return True if the given date is a Kenya public holiday."""
    return date in get_holidays_for_year(date.year)


def get_holiday_name(date: datetime.date) -> Optional[str]:
    """Return the holiday name for a date, or None if not a holiday."""
    return get_holidays_for_year(date.year).get(date)


def get_holidays_in_month(year: int, month: int) -> list[datetime.date]:
    """Return a sorted list of public holiday dates in the given month/year."""
    all_holidays = get_holidays_for_year(year)
    return sorted(d for d in all_holidays if d.month == month)


def get_overtime_rate(date: datetime.date) -> float:
    """
    Returns the overtime multiplier for a given date per Kenya's Employment Act:
      - Sunday or public holiday → 2.0x
      - Saturday or weekday     → 1.5x
    """
    if date.weekday() == 6 or is_public_holiday(date):  # Sunday = 6
        return 2.0
    return 1.5


def count_working_days_in_month(year: int, month: int) -> int:
    """
    Count the number of working days (Mon–Fri, excluding public holidays)
    in a given month. Useful for pro-rating daily/hourly salaries.
    """
    import calendar as _cal
    holidays = set(get_holidays_in_month(year, month))
    total = 0
    for day in range(1, _cal.monthrange(year, month)[1] + 1):
        d = datetime.date(year, month, day)
        if d.weekday() < 5 and d not in holidays:  # Mon–Fri, not a holiday
            total += 1
    return total
