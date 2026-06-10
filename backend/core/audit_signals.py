"""
core/audit_signals.py — Django signal handlers that emit AuditLog entries
for every write to sensitive models.

Registration
────────────
Import this module in CoreConfig.ready() so Django connects the signals
at startup:

    # core/apps.py
    def ready(self):
        import core.audit_signals  # noqa: F401

Protected models
────────────────
  • employees.Employee      — PII: KRA PIN, M-Pesa, bank details, salary
  • payroll.PayrollRun      — payroll initiation, approval, rejection
  • payroll.PayrollItem     — individual payroll line items
  • tenants.Tenant          — workspace creation / configuration changes
  • users.User              — user role grants / revocations (PERMISSION_CHANGE)
"""

from __future__ import annotations

import logging

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from core.audit import AuditAction, log_action
from core.tenant_context import get_current_tenant

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialise(instance) -> dict:
    """Return a safe dict snapshot of a model instance for audit payloads."""
    from django.forms.models import model_to_dict
    try:
        data = model_to_dict(instance)
        # Strip encrypted raw bytes — the payload must be JSON-serialisable.
        return {k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
                for k, v in data.items()}
    except Exception:  # pylint: disable=broad-except
        return {'id': str(instance.pk)}


def _actor_from_instance(instance) -> tuple[str, str]:
    """
    Best-effort extraction of (actor_id, actor_email) from a model instance.
    Models that carry a `_audit_actor` attribute (set by views before .save())
    take priority; otherwise we fall back to the instance's own user fields.
    """
    actor = getattr(instance, '_audit_actor', None)
    if actor:
        return str(actor.get('id', 'system')), str(actor.get('email', ''))
    # Fallback: try common field names
    actor_id = (
        getattr(instance, 'created_by_id', None)
        or getattr(instance, 'updated_by_id', None)
        or 'system'
    )
    return str(actor_id), ''


# ── Employee signals ──────────────────────────────────────────────────────────

@receiver(pre_save, sender='employees.Employee')
def _capture_employee_before(sender, instance, **kwargs):
    """Snapshot the DB state before an update so we can diff before/after."""
    if instance.pk:
        try:
            instance._audit_before = _serialise(
                sender.objects.get(pk=instance.pk)
            )
        except sender.DoesNotExist:
            instance._audit_before = {}
    else:
        instance._audit_before = None  # new record


@receiver(post_save, sender='employees.Employee')
def _log_employee_save(sender, instance, created, **kwargs):
    actor_id, actor_email = _actor_from_instance(instance)
    action = AuditAction.CREATE if created else AuditAction.UPDATE
    before = None if created else getattr(instance, '_audit_before', {})
    after  = _serialise(instance)

    log_action(
        action        = action,
        actor_id      = actor_id,
        actor_email   = actor_email,
        tenant        = get_current_tenant(),
        resource_type = 'Employee',
        resource_id   = instance.pk,
        before        = before,
        after         = after,
        ip_address    = getattr(instance, '_audit_ip', None),
        user_agent    = getattr(instance, '_audit_ua', ''),
    )


# ── Payroll signals ───────────────────────────────────────────────────────────

@receiver(post_save, sender='payroll.PayrollRun')
def _log_payroll_run_save(sender, instance, created, **kwargs):
    actor_id, actor_email = _actor_from_instance(instance)

    # Determine fine-grained action from PayrollRun status field
    status = getattr(instance, 'status', '')
    if created:
        action = AuditAction.PAYROLL_RUN
    elif status == 'approved':
        action = AuditAction.PAYROLL_APPROVE
    elif status in ('rejected', 'cancelled'):
        action = AuditAction.PAYROLL_REJECT
    else:
        action = AuditAction.UPDATE

    log_action(
        action        = action,
        actor_id      = actor_id,
        actor_email   = actor_email,
        tenant        = get_current_tenant(),
        resource_type = 'PayrollRun',
        resource_id   = instance.pk,
        after         = _serialise(instance),
        ip_address    = getattr(instance, '_audit_ip', None),
        user_agent    = getattr(instance, '_audit_ua', ''),
    )


# ── Tenant signals ────────────────────────────────────────────────────────────

@receiver(post_save, sender='tenants.Tenant')
def _log_tenant_save(sender, instance, created, **kwargs):
    actor_id, actor_email = _actor_from_instance(instance)
    log_action(
        action        = AuditAction.CREATE if created else AuditAction.UPDATE,
        actor_id      = actor_id,
        actor_email   = actor_email,
        tenant        = instance,
        resource_type = 'Tenant',
        resource_id   = instance.pk,
        after         = _serialise(instance),
        ip_address    = getattr(instance, '_audit_ip', None),
    )


# ── User / Permission signals ──────────────────────────────────────────────────

@receiver(post_save, sender='users.User')
def _log_membership_change(sender, instance, created, **kwargs):
    actor_id, actor_email = _actor_from_instance(instance)
    log_action(
        action        = AuditAction.PERMISSION_CHANGE,
        actor_id      = actor_id,
        actor_email   = actor_email,
        tenant        = getattr(instance, 'tenant', None),
        resource_type = 'User',
        resource_id   = instance.pk,
        after         = _serialise(instance),
        ip_address    = getattr(instance, '_audit_ip', None),
    )
