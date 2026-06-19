import uuid
import logging
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)

# Thread-local storage for the request-scoped fields injected into every log record.
import threading
_request_context = threading.local()


def get_request_id() -> str:
    """Return the current request's ID, or an empty string outside request context."""
    return getattr(_request_context, 'request_id', '')


def get_request_tenant_id() -> str:
    return getattr(_request_context, 'tenant_id', '')


def get_request_user_id() -> str:
    return getattr(_request_context, 'user_id', '')


class RequestIDMiddleware:
    """
    Assigns a UUID X-Request-ID to every inbound request and echoes it back
    in the response header.  The ID is stored in thread-local storage so it
    can be injected into every log record via WorkwiseJsonFormatter without
    passing the request object around.

    Position: must come *before* TenantMiddleware in MIDDLEWARE so that the
    request_id is available during tenant resolution logs.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Honour a forwarded request ID (e.g. from an upstream load-balancer)
        request_id = (
            request.META.get('HTTP_X_REQUEST_ID')
            or str(uuid.uuid4())
        )
        request.request_id = request_id
        _request_context.request_id = request_id
        _request_context.tenant_id = ''
        _request_context.user_id = ''

        response = self.get_response(request)

        # Inject resolved context after DRF authentication has run
        if hasattr(request, 'user') and request.user and request.user.is_authenticated:
            _request_context.user_id = str(getattr(request.user, 'pk', ''))
            tenant = getattr(request.user, 'tenant', None)
            if tenant:
                _request_context.tenant_id = str(getattr(tenant, 'id', ''))

        response['X-Request-ID'] = request_id

        # Clean up thread-local to avoid leaking into the next request
        # on a reused thread (Gunicorn worker pool).
        _request_context.request_id = ''
        _request_context.tenant_id = ''
        _request_context.user_id = ''

        return response


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
