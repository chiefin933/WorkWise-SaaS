"""
finance/signals.py
------------------
Connects Django signals to auto-post journal entries when:
  - A PayrollRun transitions to 'approved'
  - An ExpenseClaim transitions to 'paid'
  - A PettyCashTransaction transitions to 'disbursed'
  - A new Tenant is created → seed Chart of Accounts
"""

import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


# ── Seed COA on new tenant ─────────────────────────────────────────────────────

@receiver(post_save, sender='tenants.Tenant')
def seed_coa_on_tenant_create(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        from finance.seed_coa import seed_chart_of_accounts
        seed_chart_of_accounts(instance)
        logger.info("Seeded Chart of Accounts for new tenant: %s", instance.name)
    except Exception as exc:
        logger.error("Failed to seed COA for tenant %s: %s", instance.name, exc)


# ── Auto-post payroll ──────────────────────────────────────────────────────────

@receiver(pre_save, sender='payroll.PayrollRun')
def capture_payroll_status_before_save(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        instance._pre_save_status = sender.objects.get(pk=instance.pk).status
    except sender.DoesNotExist:
        instance._pre_save_status = None


@receiver(post_save, sender='payroll.PayrollRun')
def auto_post_payroll(sender, instance, created, **kwargs):
    if created:
        return
    old_status = getattr(instance, '_pre_save_status', None)
    if old_status != 'approved' and instance.status == 'approved':
        # Check if a JE was already posted for this run
        from finance.books_models import JournalEntry
        ref = f"PR-{instance.year}-{instance.month:02d}"
        if not JournalEntry.objects.filter(
            tenant=instance.tenant,
            reference=ref,
            source='PAYROLL',
            status='POSTED',
        ).exists():
            from finance.auto_post import post_payroll_to_books
            post_payroll_to_books(instance)


# ── Auto-post expense claims ──────────────────────────────────────────────────

@receiver(pre_save, sender='finance.ExpenseClaim')
def capture_expense_status_before_save(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        instance._pre_save_status = sender.objects.get(pk=instance.pk).status
    except sender.DoesNotExist:
        instance._pre_save_status = None


@receiver(post_save, sender='finance.ExpenseClaim')
def auto_post_expense(sender, instance, created, **kwargs):
    if created:
        return
    old_status = getattr(instance, '_pre_save_status', None)
    if old_status != 'paid' and instance.status == 'paid':
        from finance.auto_post import post_expense_to_books
        post_expense_to_books(instance)


# ── Auto-post petty cash disbursements ────────────────────────────────────────

@receiver(pre_save, sender='finance.PettyCashTransaction')
def capture_petty_status_before_save(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        instance._pre_save_status = sender.objects.get(pk=instance.pk).status
    except sender.DoesNotExist:
        instance._pre_save_status = None


@receiver(post_save, sender='finance.PettyCashTransaction')
def auto_post_petty_cash(sender, instance, created, **kwargs):
    if created:
        return
    old_status = getattr(instance, '_pre_save_status', None)
    if old_status != 'disbursed' and instance.status == 'disbursed':
        from finance.auto_post import post_petty_cash_to_books
        post_petty_cash_to_books(instance)
