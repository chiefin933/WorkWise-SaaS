"""
core/role_permissions_model.py
--------------------------------
Stores per-tenant role permission customisations.
Each tenant can add or remove permissions from any role.
ADMIN role overrides are always ignored (ADMIN = full access).
"""
import uuid
from django.db import models
from core.rbac import DEFAULT_ROLE_PERMISSIONS, PERMISSIONS


class RolePermission(models.Model):
    """
    One record per tenant.
    permissions JSON structure:
    {
      "HR":      {"added": ["payroll.approve"], "removed": ["employee.delete"]},
      "FINANCE": {"added": [], "removed": []},
      "EMPLOYEE":{"added": [], "removed": []}
    }
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant     = models.OneToOneField(
        'tenants.Tenant', on_delete=models.CASCADE, related_name='role_permissions'
    )
    permissions = models.JSONField(
        default=dict,
        help_text='Per-role permission overrides: {role: {added: [], removed: []}}',
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"RolePermissions — {self.tenant.name}"

    def get_effective_permissions(self, role: str) -> list[str]:
        """Return sorted list of effective permissions for a role."""
        from core.rbac import get_role_permissions
        return sorted(get_role_permissions(role, self.permissions))

    def add_permission(self, role: str, permission: str) -> None:
        if role == 'ADMIN':
            return  # ADMIN always has everything
        if permission not in PERMISSIONS:
            raise ValueError(f"Unknown permission: {permission}")
        overrides = self.permissions.get(role, {'added': [], 'removed': []})
        if permission not in overrides['added']:
            overrides['added'].append(permission)
        if permission in overrides.get('removed', []):
            overrides['removed'].remove(permission)
        self.permissions[role] = overrides
        self.save(update_fields=['permissions', 'updated_at'])

    def remove_permission(self, role: str, permission: str) -> None:
        if role == 'ADMIN':
            return  # Cannot restrict ADMIN
        # Only allow removing if it's in the default set for this role
        overrides = self.permissions.get(role, {'added': [], 'removed': []})
        if permission not in overrides.get('removed', []):
            overrides.setdefault('removed', []).append(permission)
        if permission in overrides.get('added', []):
            overrides['added'].remove(permission)
        self.permissions[role] = overrides
        self.save(update_fields=['permissions', 'updated_at'])

    def reset_role(self, role: str) -> None:
        """Reset a role to its default permissions."""
        if role in self.permissions:
            del self.permissions[role]
            self.save(update_fields=['permissions', 'updated_at'])
