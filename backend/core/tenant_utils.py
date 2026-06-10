from rest_framework.response import Response
from rest_framework import status


def get_user_tenant(request):
    """Return the authenticated user's tenant or None."""
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return None
    return getattr(user, 'tenant', None)


def tenant_required(request):
    """Return (tenant, None) or (None, error Response)."""
    tenant = get_user_tenant(request)
    if not tenant:
        return None, Response(
            {"error": "No organization linked to this account. Complete registration or contact support."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return tenant, None
