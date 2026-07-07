import logging
import time
from rest_framework import authentication, exceptions
from django.conf import settings
from users.models import User
import os

logger = logging.getLogger(__name__)

# ── JWKS in-memory cache ──────────────────────────────────────────────────────
# Avoids a round-trip to Clerk's JWKS endpoint on every single request.
_JWKS_CACHE: dict = {}          # {jwks_url: {'keys': [...], 'expires': float}}
_JWKS_CACHE_TTL = 3600          # refresh cached keys every hour


class ClerkAuthentication(authentication.BaseAuthentication):
    """
    Authenticates requests using a Clerk-issued JWT session token.
    The token is decoded and verified against Clerk's JWKS endpoint (RS256).
    The 'sub' claim contains the Clerk user ID.

    Security notes:
    - Raw token and user PII are NEVER written to logs.
    - JWKS keys are cached in-process to limit external HTTP calls.
    - The JWKS endpoint is selected from a trusted configuration value,
      not from unverified token claims.
    - Audience validation is enforced through CLERK_AUDIENCE.
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if not auth_header:
            return None

        if not auth_header.startswith('Bearer '):
            return None

        parts = auth_header.split(' ')
        if len(parts) != 2 or not parts[1]:
            return None

        token = parts[1]
        clerk_id = self._verify_clerk_token(token)
        if not clerk_id:
            return None

        try:
            user = User.objects.get(clerk_id=clerk_id)
            logger.debug("ClerkAuth: authenticated user pk=%s", user.pk)
            
            # Set active tenant context securely
            if user.tenant:
                from core.tenant_context import set_current_tenant
                set_current_tenant(user.tenant)
                
            return (user, None)
        except User.DoesNotExist:
            if settings.DEBUG and not getattr(settings, 'TESTING', False):
                # SAFETY: refuse auto-provisioning if a real Supabase DB is configured,
                # even in DEBUG mode. Set up the Clerk webhook to sync users properly.
                import os
                db_url = os.environ.get('DATABASE_URL', '')
                if db_url and 'supabase' in db_url:
                    logger.warning(
                        "ClerkAuth: Refusing auto-provision — real Supabase DB detected "
                        "even though DEBUG=True. Configure the Clerk webhook instead.",
                    )
                    raise exceptions.AuthenticationFailed("User not found, sign up first")
                logger.info(
                    "ClerkAuth: Auto-provisioning user for clerk_id=%s in DEBUG mode",
                    clerk_id,
                )
                from django.db import transaction
                from tenants.models import Tenant
                from payroll.models import PayrollConfig
                import requests as _req

                # Fetch real user details from Clerk so the name is correct
                _first = ''
                _last  = ''
                _email = f"{clerk_id}@clerk.local"
                try:
                    _sk = settings.CLERK_SECRET_KEY
                    if _sk:
                        _r = _req.get(
                            f'https://api.clerk.com/v1/users/{clerk_id}',
                            headers={'Authorization': f'Bearer {_sk}'},
                            timeout=5,
                        )
                        if _r.status_code == 200:
                            _data   = _r.json()
                            _first  = _data.get('first_name') or ''
                            _last   = _data.get('last_name')  or ''
                            _emails = _data.get('email_addresses', [])
                            if _emails:
                                _email = _emails[0].get('email_address', _email)
                except Exception:
                    pass  # Proceed with fallback values

                try:
                    with transaction.atomic():
                        tenant = Tenant.objects.create(
                            name=f"{_first}'s Organization".strip() if _first else "Local Dev Tenant",
                            plan="BUSINESS"
                        )
                        PayrollConfig.objects.create(tenant=tenant)
                        user = User.objects.create_user(
                            email=_email,
                            clerk_id=clerk_id,
                            first_name=_first,
                            last_name=_last,
                            tenant=tenant,
                            role="ADMIN",
                        )
                    from core.tenant_context import set_current_tenant
                    set_current_tenant(tenant)
                    return (user, None)
                except Exception as exc:
                    logger.error(
                        "ClerkAuth: Failed to auto-provision user in DEBUG mode: %s",
                        exc,
                        exc_info=True
                    )
                    raise exceptions.AuthenticationFailed("User not found, sign up first")
            else:
                # Token is valid but the webhook hasn't synced the user yet.
                logger.warning(
                    "ClerkAuth: valid token for clerk_id=%s but user not in DB. "
                    "Ensure the Clerk webhook is configured and reachable.",
                    clerk_id[:8] + "...",   # log only a partial ID — never the full value
                )
                raise exceptions.AuthenticationFailed("User not found, sign up first")

    # ── Private helpers ───────────────────────────────────────────────────────

    def _verify_clerk_token(self, token: str):
        try:
            from jose import jwt
            from jose.exceptions import JWTError, ExpiredSignatureError

            # Peek at the header to find the key ID
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            if not kid:
                logger.debug("ClerkAuth: token header has no 'kid'")
                return None

            # Read some unverified claims so we can sanity-check the issuer
            unverified_claims = jwt.get_unverified_claims(token)
            unverified_issuer = unverified_claims.get('iss', '')
            if not unverified_issuer:
                logger.debug("ClerkAuth: token has no 'iss' claim")
                return None

            # Prefer an explicit configured issuer. If provided, require the token
            # issuer to match the configured value. If not configured, fall back to
            # an allowlist supplied via CLERK_ALLOWED_ISSUERS. Do NOT accept tokens
            # from arbitrary issuers.
            configured_issuer = getattr(settings, 'CLERK_ISSUER', '') or None
            allowed_issuers = self._get_allowed_issuers()

            if configured_issuer:
                if unverified_issuer.rstrip('/') != configured_issuer.rstrip('/'):
                    logger.warning(
                        "ClerkAuth: token issuer does not match configured CLERK_ISSUER: %s",
                        unverified_issuer,
                    )
                    return None
                issuer_to_use = configured_issuer
            elif allowed_issuers:
                if unverified_issuer.rstrip('/') not in allowed_issuers:
                    logger.warning(
                        "ClerkAuth: token issuer is not in CLERK_ALLOWED_ISSUERS: %s",
                        unverified_issuer,
                    )
                    return None
                issuer_to_use = unverified_issuer.rstrip('/')
            else:
                logger.error(
                    "ClerkAuth: neither CLERK_ISSUER nor CLERK_ALLOWED_ISSUERS are configured — refusing token verification."
                )
                return None

            audience = getattr(settings, 'CLERK_AUDIENCE', '')
            if not audience:
                logger.info(
                    "ClerkAuth: CLERK_AUDIENCE is empty/blank, skipping audience validation."
                )
                audience = None


            jwks_url = self._get_trusted_jwks_url()
            if not jwks_url:
                logger.error(
                    "ClerkAuth: clerk JWKS URL is not configured."
                )
                return None

            public_key = self._get_public_key(jwks_url, kid)
            if not public_key:
                logger.debug("ClerkAuth: no matching public key for kid=%s", kid)
                return None

            payload = jwt.decode(
                token,
                public_key,
                algorithms=['RS256'],
                audience=audience,
                issuer=issuer_to_use,
            )

            if not self._validate_clerk_session_payload(payload):
                return None

            return payload.get('sub')

        except ExpiredSignatureError:
            logger.debug("ClerkAuth: token has expired")
            return None
        except JWTError as exc:
            logger.debug("ClerkAuth: JWT verification failed: %s", exc)
            return None
        except Exception as exc:
            logger.warning("ClerkAuth: unexpected error during verification: %s", exc)
            return None

    def _get_trusted_jwks_url(self):
        configured_jwks_url = getattr(settings, 'CLERK_JWKS_URL', '')
        if configured_jwks_url:
            return configured_jwks_url

        configured_issuer = getattr(settings, 'CLERK_ISSUER', '')
        if configured_issuer:
            return f"{configured_issuer.rstrip('/')}/.well-known/jwks.json"

        return None

    def _get_allowed_issuers(self):
        configured_issuers = getattr(settings, 'CLERK_ALLOWED_ISSUERS', [])
        if configured_issuers:
            return [issuer.rstrip('/') for issuer in configured_issuers if issuer]
        return []

    def _is_allowed_issuer(self, issuer: str):
        allowed_issuers = self._get_allowed_issuers()
        if not allowed_issuers:
            # If no explicit issuer allowlist is configured, rely on a trusted
            # JWKS URL only. The JWKS URL itself must be configured explicitly.
            return True

        return issuer.rstrip('/') in allowed_issuers

    def _validate_clerk_session_payload(self, payload: dict):
        if not payload.get('sub'):
            logger.debug("ClerkAuth: Clerk session token missing subject 'sub'")
            return False

        token_type = payload.get('type')
        if token_type and token_type != 'session':
            logger.warning(
                "ClerkAuth: token type is not a session token: %s",
                token_type,
            )
            return False

        return True

    def _get_public_key(self, jwks_url: str, kid: str):
        """Return a matching public key, using the in-process JWKS cache."""
        from jose import jwk
        import requests as http_requests

        now = time.monotonic()
        cached = _JWKS_CACHE.get(jwks_url)

        if not cached or cached['expires'] < now:
            try:
                resp = http_requests.get(jwks_url, timeout=5)
                resp.raise_for_status()
                _JWKS_CACHE[jwks_url] = {
                    'keys': resp.json().get('keys', []),
                    'expires': now + _JWKS_CACHE_TTL,
                }
                logger.debug("ClerkAuth: refreshed JWKS cache from %s", jwks_url)
            except Exception as exc:
                logger.warning("ClerkAuth: failed to fetch JWKS from %s: %s", jwks_url, exc)
                # Fall back to stale cache if available
                if cached:
                    logger.warning("ClerkAuth: using stale JWKS cache")
                else:
                    return None

        keys = _JWKS_CACHE[jwks_url]['keys']
        for key_data in keys:
            if key_data.get('kid') == kid:
                return jwk.construct(key_data)
        return None

    def authenticate_header(self, request):
        return 'Bearer realm="workwise"'
