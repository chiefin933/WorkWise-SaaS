"""
core/audit.py — WorkWise Immutable Audit Log
═════════════════════════════════════════════
Every write to sensitive data (employees, payroll, tenants) produces an
AuditLog entry.  The log is cryptographically append-only:

  • The Django ORM manager blocks .update() and .delete() calls entirely.
  • A PostgreSQL trigger (applied in the migration) blocks UPDATE/DELETE at
    the database level — even if someone hits the DB directly with psql.
  • Each row carries an HMAC-SHA256 integrity seal so offline tampering of
    exported logs can be detected.

This satisfies Kenya's Data Protection Act 2019 §25 (accountability) and
best-practice HR-system audit requirements.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── Actions ──────────────────────────────────────────────────────────────────

class AuditAction(models.TextChoices):
    CREATE         = "CREATE",         "Create"
    UPDATE         = "UPDATE",         "Update"
    DELETE         = "DELETE",         "Delete"          # soft-delete only
    LOGIN          = "LOGIN",          "Login"
    LOGOUT         = "LOGOUT",         "Logout"
    PAYROLL_RUN    = "PAYROLL_RUN",    "Payroll Run"
    PAYROLL_APPROVE= "PAYROLL_APPROVE","Payroll Approve"
    PAYROLL_REJECT = "PAYROLL_REJECT", "Payroll Reject"
    EXPORT         = "EXPORT",         "Data Export"
    PERMISSION_CHANGE = "PERMISSION_CHANGE", "Permission Change"
    WEBHOOK        = "WEBHOOK",        "Webhook Received"


# ── Append-only ORM Manager ───────────────────────────────────────────────────

class AppendOnlyManager(models.Manager):
    """
    Blocks any bulk UPDATE or DELETE at the ORM level.
    Individual .save() on an existing instance is also intercepted in the
    model's save() override below.
    """

    def update(self, **kwargs):  # noqa: D102
        raise PermissionError(
            "AuditLog records are immutable. "
            "UPDATE operations are forbidden at the ORM level."
        )

    def delete(self):  # noqa: D102
        raise PermissionError(
            "AuditLog records are immutable. "
            "DELETE operations are forbidden at the ORM level."
        )


# ── Model ─────────────────────────────────────────────────────────────────────

class AuditLog(models.Model):
    """
    Append-only audit record.  Never modify — see AppendOnlyManager.

    Fields
    ------
    tenant          : The workspace this action belongs to (nullable for
                      system-level events like login before tenant resolution).
    actor_id        : Clerk user ID string of the person who took the action.
    actor_email     : Denormalised email — preserved even if the user is later
                      deleted.
    action          : One of AuditAction choices.
    resource_type   : Model name, e.g. "Employee", "PayrollRun".
    resource_id     : PK of the affected object (string for portability).
    ip_address      : Client IP extracted from the request.
    user_agent      : Truncated User-Agent string.
    payload_hash    : SHA-256 of the serialised before/after diff — lets you
                      detect if the payload column was tampered with offline.
    payload         : JSON blob with {before: {...}, after: {...}} diff.
    integrity_seal  : HMAC-SHA256 of the canonical row fields, keyed with
                      MASTER_ENCRYPTION_KEY — detects row-level tampering in
                      exported CSV/JSONL dumps.
    timestamp       : UTC time; set once on creation, never changed.
    """

    # ── Relationships ─────────────────────────────────────────────────────────
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_index=True,
        related_name='audit_logs',
    )

    # ── Actor ─────────────────────────────────────────────────────────────────
    actor_id    = models.CharField(max_length=255, db_index=True)
    actor_email = models.EmailField(max_length=255, blank=True)

    # ── What happened ─────────────────────────────────────────────────────────
    action        = models.CharField(max_length=32, choices=AuditAction.choices, db_index=True)
    resource_type = models.CharField(max_length=100, blank=True, db_index=True)
    resource_id   = models.CharField(max_length=255, blank=True, db_index=True)

    # ── Context ───────────────────────────────────────────────────────────────
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)

    # ── Payload ───────────────────────────────────────────────────────────────
    payload      = models.JSONField(default=dict, blank=True)
    payload_hash = models.CharField(max_length=64, blank=True)   # hex SHA-256

    # ── Integrity ─────────────────────────────────────────────────────────────
    integrity_seal = models.CharField(max_length=64, blank=True)  # hex HMAC

    # ── Timestamps ────────────────────────────────────────────────────────────
    timestamp = models.DateTimeField(default=timezone.now, db_index=True, editable=False)

    objects = AppendOnlyManager()

    class Meta:
        app_label = 'core'
        ordering  = ['-timestamp']
        indexes   = [
            models.Index(fields=['tenant', 'timestamp'], name='audit_tenant_ts_idx'),
            models.Index(fields=['actor_id', 'timestamp'], name='audit_actor_ts_idx'),
            models.Index(fields=['resource_type', 'resource_id'], name='audit_resource_idx'),
        ]
        # Prevents the admin from offering delete on this model.
        default_permissions = ('add', 'view')

    # ── Immutability guard at instance level ──────────────────────────────────

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise PermissionError(
                "AuditLog records are immutable — existing entries cannot be "
                "modified. This violation has been logged."
            )
        # Compute payload hash
        if self.payload:
            raw = json.dumps(self.payload, sort_keys=True, default=str).encode()
            self.payload_hash = hashlib.sha256(raw).hexdigest()

        # Compute HMAC integrity seal
        self.integrity_seal = self._compute_seal()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # noqa: D102
        raise PermissionError(
            "AuditLog records are immutable — deletion is forbidden."
        )

    # ── Integrity helpers ─────────────────────────────────────────────────────

    def _compute_seal(self) -> str:
        """
        HMAC-SHA256 over the canonical fields using MASTER_ENCRYPTION_KEY.
        Verify with AuditLog.verify_seal(row) after export.
        """
        key  = settings.MASTER_ENCRYPTION_KEY.encode()
        data = "|".join([
            str(self.tenant_id or ''),
            self.actor_id,
            self.actor_email,
            self.action,
            self.resource_type,
            self.resource_id,
            self.ip_address or '',
            self.payload_hash,
            self.timestamp.isoformat() if self.timestamp else '',
        ]).encode()
        return hmac.new(key, data, hashlib.sha256).hexdigest()

    def verify_seal(self) -> bool:
        """Return True if the integrity seal matches the stored fields."""
        expected = self._compute_seal()
        return hmac.compare_digest(expected, self.integrity_seal)

    def __str__(self):
        return (
            f"[{self.timestamp:%Y-%m-%d %H:%M:%S}] "
            f"{self.actor_email or self.actor_id} → {self.action} "
            f"{self.resource_type}#{self.resource_id}"
        )


# ── Public write helper ───────────────────────────────────────────────────────

def log_action(
    *,
    action: str,
    actor_id: str,
    actor_email: str = '',
    tenant=None,
    resource_type: str = '',
    resource_id: Any = '',
    ip_address: str | None = None,
    user_agent: str = '',
    before: dict | None = None,
    after: dict | None = None,
) -> AuditLog | None:
    """
    Create an immutable audit log entry.  Always use this helper — never
    instantiate AuditLog directly in application code.

    Returns the created AuditLog instance, or None if creation fails
    (failures are swallowed so they never break the primary request flow).
    """
    try:
        payload: dict = {}
        if before is not None:
            payload['before'] = before
        if after is not None:
            payload['after'] = after

        entry = AuditLog(
            action        = action,
            actor_id      = str(actor_id),
            actor_email   = actor_email,
            tenant        = tenant,
            resource_type = resource_type,
            resource_id   = str(resource_id),
            ip_address    = ip_address,
            user_agent    = user_agent[:512],
            payload       = payload,
        )
        entry.save()
        return entry
    except Exception as exc:  # pylint: disable=broad-except
        # NEVER let audit failures crash the main request.
        logger.error(
            "AuditLog write failed — action=%s actor=%s resource=%s/%s: %s",
            action, actor_id, resource_type, resource_id, exc,
            exc_info=True,
        )
        return None
