from django.db import models
from core.tenant_context import get_current_tenant
import logging

logger = logging.getLogger(__name__)


class TenantQuerySet(models.QuerySet):
    """Custom QuerySet that could implement additional tenant-specific constraints."""
    pass


class TenantManager(models.Manager):
    """
    A custom manager that automatically filters all operational database queries
    by the current context-active tenant.
    """
    def get_queryset(self):
        qs = TenantQuerySet(self.model, using=self._db)
        active_tenant = get_current_tenant()
        
        if active_tenant:
            # Enforce direct tenant isolation
            if hasattr(self.model, 'tenant'):
                logger.debug(f"Auto-isolating query on {self.model.__name__} by tenant: {active_tenant}")
                return qs.filter(tenant=active_tenant)
            # Enforce indirect tenant isolation (via employee relation)
            elif hasattr(self.model, 'employee'):
                logger.debug(f"Auto-isolating query on {self.model.__name__} by employee__tenant: {active_tenant}")
                return qs.filter(employee__tenant=active_tenant)
        
        return qs


class TenantScopedModel(models.Model):
    """
    An abstract base model representing multi-tenant objects.
    Replaces the default manager with TenantManager to enforce auto-isolation,
    while leaving a separate 'unscoped' manager for admin/auth tasks.
    """
    # The primary manager is tenant-isolated
    objects = TenantManager()
    
    # Explicit unscoped manager for cross-tenant admin operations
    unscoped = models.Manager()

    class Meta:
        abstract = True
