"""
core/models.py — re-exports all core models so Django's migration
framework discovers them automatically via INSTALLED_APPS.
"""
from core.audit import AuditLog, AuditAction                    # noqa: F401
from core.role_permissions_model import RolePermission           # noqa: F401
