"""
core/scheduled_tasks.py
------------------------
Celery Beat periodic tasks for WorkWise.

Schedule (configured in settings.CELERY_BEAT_SCHEDULE):
  Every day at 08:00 EAT:
    - check_absent_employees       — flag employees with no clock-in
    - send_birthday_reminders      — notify HR of employee birthdays
    - check_probation_endings      — alert HR when probation period ends in 7 days
    - check_contract_expiry        — alert HR of contracts expiring in 30/7/1 days

  Last day of every month:
    - send_payroll_reminders       — remind HR/Finance to run payroll

  1 January every year:
    - reset_annual_leave_balances  — reset annual leave entitlements
"""

import logging
from datetime import date, timedelta
from celery import shared_task

logger = logging.getLogger(__name__)


# ── Daily Tasks ───────────────────────────────────────────────────────────────

@shared_task(name='core.check_absent_employees', acks_late=True)
def check_absent_employees():
    """
    Runs at 09:00 EAT every working day.
    For each tenant: find active employees who have no attendance record for today
    (and today is a working day — not public holiday, not weekend).
    Creates a system notification for HR managers summarising absent count.
    """
    from tenants.models import Tenant
    from employees.models import Employee
    from attendance.models import Attendance
    from users.models import User, Notification
    from core.kenya_holidays import is_public_holiday

    today = date.today()

    # Skip weekends and public holidays
    if today.weekday() >= 5 or is_public_holiday(today):
        logger.info("check_absent_employees: skipping — today is a weekend/holiday (%s)", today)
        return {'skipped': True, 'reason': 'weekend_or_holiday', 'date': str(today)}

    processed = 0
    for tenant in Tenant.objects.filter(subscription_status__in=('TRIAL', 'ACTIVE')):
        active_employees = Employee.unscoped.filter(tenant=tenant, status='active')
        clocked_in_ids   = set(
            Attendance.unscoped.filter(
                employee__tenant=tenant, date=today
            ).values_list('employee_id', flat=True)
        )
        absent = active_employees.exclude(id__in=clocked_in_ids)
        absent_count = absent.count()

        if absent_count == 0:
            continue

        # Notify all HR managers
        hr_users = User.objects.filter(tenant=tenant, role__in=('ADMIN', 'HR'), is_active=True)
        absent_names = ', '.join(absent.values_list('name', flat=True)[:5])
        if absent_count > 5:
            absent_names += f' and {absent_count - 5} more'

        for hr_user in hr_users:
            Notification.objects.create(
                tenant=tenant,
                recipient=hr_user,
                type='system',
                title=f'{absent_count} employee(s) absent today',
                message=f'No clock-in recorded for {today.strftime("%d %b %Y")}: {absent_names}.',
                action_url='/attendance',
            )
        processed += 1
        logger.info("Absent check for %s: %d absent employees notified", tenant.name, absent_count)

    return {'tenants_processed': processed, 'date': str(today)}


@shared_task(name='core.send_birthday_reminders', acks_late=True)
def send_birthday_reminders():
    """
    Runs daily. Finds employees whose birthday is today and notifies HR.
    """
    from tenants.models import Tenant
    from employees.models import Employee
    from users.models import User, Notification

    today = date.today()
    notified = 0

    for tenant in Tenant.objects.filter(subscription_status__in=('TRIAL', 'ACTIVE')):
        # Filter by month and day (ignore year — birth_date field)
        birthday_employees = Employee.unscoped.filter(
            tenant=tenant,
            status='active',
            birth_date__month=today.month,
            birth_date__day=today.day,
        )
        if not birthday_employees.exists():
            continue

        hr_users = User.objects.filter(tenant=tenant, role__in=('ADMIN', 'HR'), is_active=True)
        names = ', '.join(birthday_employees.values_list('name', flat=True))

        for hr_user in hr_users:
            Notification.objects.create(
                tenant=tenant,
                recipient=hr_user,
                type='employee',
                title=f'🎂 Birthday reminder',
                message=f"Today is the birthday of: {names}. Consider sending a celebration message!",
                action_url='/employees',
            )
        notified += birthday_employees.count()

    return {'employees_with_birthdays': notified, 'date': str(today)}


@shared_task(name='core.check_probation_endings', acks_late=True)
def check_probation_endings():
    """
    Runs daily. Alerts HR when an employee's probation period ends in exactly 7 days.
    Requires Employee.probation_end_date field (added in employee lifecycle task).
    """
    from tenants.models import Tenant
    from employees.models import Employee
    from users.models import User, Notification

    alert_date = date.today() + timedelta(days=7)
    notified   = 0

    for tenant in Tenant.objects.filter(subscription_status__in=('TRIAL', 'ACTIVE')):
        ending_soon = Employee.unscoped.filter(
            tenant=tenant,
            status='active',
            lifecycle_stage='probation',
            probation_end_date=alert_date,
        )
        if not ending_soon.exists():
            continue

        hr_users = User.objects.filter(tenant=tenant, role__in=('ADMIN', 'HR'), is_active=True)
        for emp in ending_soon:
            for hr_user in hr_users:
                Notification.objects.create(
                    tenant=tenant,
                    recipient=hr_user,
                    type='employee',
                    title=f'Probation ending: {emp.name}',
                    message=(
                        f"{emp.name}'s probation period ends on "
                        f"{alert_date.strftime('%d %b %Y')}. "
                        f"Please review and confirm or extend."
                    ),
                    action_url=f'/employees/{emp.id}',
                )
            notified += 1

    return {'probation_alerts_sent': notified}


@shared_task(name='core.check_contract_expiry', acks_late=True)
def check_contract_expiry():
    """
    Runs daily. Alerts HR when employee contracts expire in 30, 7, or 1 day(s).
    Requires Employee.contract_end_date field.
    """
    from tenants.models import Tenant
    from employees.models import Employee
    from users.models import User, Notification

    today = date.today()
    alert_days = [30, 7, 1]
    notified   = 0

    for tenant in Tenant.objects.filter(subscription_status__in=('TRIAL', 'ACTIVE')):
        hr_users = User.objects.filter(tenant=tenant, role__in=('ADMIN', 'HR'), is_active=True)
        if not hr_users.exists():
            continue

        for days in alert_days:
            expiry_date = today + timedelta(days=days)
            expiring = Employee.unscoped.filter(
                tenant=tenant,
                status='active',
                contract_end_date=expiry_date,
            )
            for emp in expiring:
                day_label = f'{days} day' if days == 1 else f'{days} days'
                for hr_user in hr_users:
                    Notification.objects.create(
                        tenant=tenant,
                        recipient=hr_user,
                        type='employee',
                        title=f'Contract expiry: {emp.name} — {day_label}',
                        message=(
                            f"{emp.name}'s contract expires on "
                            f"{expiry_date.strftime('%d %b %Y')} ({day_label} remaining). "
                            f"Please initiate renewal or offboarding."
                        ),
                        action_url=f'/employees/{emp.id}',
                    )
                notified += 1

    return {'contract_expiry_alerts': notified}


# ── Monthly Tasks ─────────────────────────────────────────────────────────────

@shared_task(name='core.send_payroll_reminders', acks_late=True)
def send_payroll_reminders():
    """
    Runs on the 25th of every month.
    Reminds HR + Finance to prepare and run payroll before month-end.
    Only fires if no payroll run exists for the current month yet.
    """
    from tenants.models import Tenant
    from payroll.models import PayrollRun
    from users.models import User, Notification
    import calendar

    today   = date.today()
    month   = today.month
    year    = today.year
    notified = 0

    for tenant in Tenant.objects.filter(subscription_status__in=('TRIAL', 'ACTIVE')):
        # Skip if payroll already started for this month
        already_started = PayrollRun.objects.filter(
            tenant=tenant, month=month, year=year
        ).exclude(status='reversed').exists()
        if already_started:
            continue

        month_name = calendar.month_name[month]
        recipients = User.objects.filter(
            tenant=tenant,
            role__in=('ADMIN', 'HR', 'FINANCE'),
            is_active=True,
        )
        for user in recipients:
            Notification.objects.create(
                tenant=tenant,
                recipient=user,
                type='payroll',
                title=f'Payroll reminder: {month_name} {year}',
                message=(
                    f"{month_name} {year} payroll has not been started yet. "
                    f"Please initiate payroll processing before month-end."
                ),
                action_url='/payroll',
            )
        notified += recipients.count()
        logger.info("Payroll reminder sent for %s (%s %s)", tenant.name, month_name, year)

    return {'reminders_sent': notified}


# ── Annual Tasks ──────────────────────────────────────────────────────────────

@shared_task(name='core.reset_annual_leave_balances', acks_late=True)
def reset_annual_leave_balances():
    """
    Runs on 1 January every year.
    Resets leave balances for the new year based on the tenant's LeavePolicy.
    Creates new LeaveBalance records for each active employee for the new year.
    """
    from tenants.models import Tenant
    from employees.models import Employee
    from leave.models import LeaveBalance, LeavePolicy
    from users.models import User, Notification

    today = date.today()
    year  = today.year
    reset_count = 0

    for tenant in Tenant.objects.filter(subscription_status__in=('TRIAL', 'ACTIVE')):
        try:
            policy = LeavePolicy.unscoped.get(tenant=tenant)
        except LeavePolicy.DoesNotExist:
            continue

        employees = Employee.unscoped.filter(tenant=tenant, status__in=('active', 'confirmed'))
        for emp in employees:
            for leave_type, entitled_days in [
                ('annual',    policy.annual_days),
                ('sick',      policy.sick_days),
                ('maternity', policy.maternity_days),
                ('paternity', policy.paternity_days),
            ]:
                LeaveBalance.objects.get_or_create(
                    employee=emp,
                    leave_type=leave_type,
                    year=year,
                    defaults={'entitled_days': entitled_days, 'used_days': 0},
                )
            reset_count += 1

        # Notify admins
        admin_users = User.objects.filter(tenant=tenant, role='ADMIN', is_active=True)
        for admin in admin_users:
            Notification.objects.create(
                tenant=tenant,
                recipient=admin,
                type='system',
                title=f'Leave balances reset for {year}',
                message=(
                    f"Annual leave balances have been reset for all active employees "
                    f"for the year {year}."
                ),
                action_url='/leave',
            )

    logger.info("Annual leave reset complete: %d employee records created/updated", reset_count)
    return {'employees_reset': reset_count, 'year': year}
