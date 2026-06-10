import contextvars
import logging

logger = logging.getLogger(__name__)

# Context-local active tenant store
_active_tenant = contextvars.ContextVar("active_tenant", default=None)


def set_current_tenant(tenant):
    """Sets the active tenant in the current async/thread execution context."""
    logger.debug(f"Setting active tenant context: {tenant}")
    return _active_tenant.set(tenant)


def get_current_tenant():
    """Gets the active tenant in the current context."""
    return _active_tenant.get()


def clear_current_tenant():
    """Clears the active tenant context."""
    logger.debug("Clearing active tenant context")
    _active_tenant.set(None)
