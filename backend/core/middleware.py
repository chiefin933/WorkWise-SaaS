import logging
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)


class TenantMiddleware:
    """
    Extracts tenant_id from a SimpleJWT access token and attaches it to the
    request object for downstream use.

    Security notes:
    - We ONLY support SimpleJWT tokens here. Clerk tokens are resolved later
      by ClerkAuthentication inside the DRF layer, which then populates
      request.user with the correct tenant reference.
    - We intentionally DO NOT do a raw DB lookup using the token string as a
      clerk_id — that pattern could allow an attacker to probe internal user
      IDs by forging a crafted Authorization header.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from core.tenant_context import set_current_tenant, clear_current_tenant
        from tenants.models import Tenant

        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        request.tenant_id = None

        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
            try:
                access_token = AccessToken(token)
                tenant_id = access_token.get('tenant_id')
                if tenant_id:
                    request.tenant_id = str(tenant_id)
                    try:
                        tenant = Tenant.objects.get(id=tenant_id)
                        set_current_tenant(tenant)
                    except Tenant.DoesNotExist:
                        pass
            except (InvalidToken, TokenError):
                # Not a SimpleJWT token (e.g. a Clerk token).
                # tenant_id will be populated from request.user.tenant by the
                # view layer after DRF authentication runs.
                pass
            except Exception as exc:
                logger.debug("TenantMiddleware: unexpected error: %s", exc)

        try:
            response = self.get_response(request)
        finally:
            clear_current_tenant()

        return response
