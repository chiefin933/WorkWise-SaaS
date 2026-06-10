from django.conf import settings
from django.test import SimpleTestCase, override_settings

from core.authentication import ClerkAuthentication


class ClerkAuthenticationConfigTests(SimpleTestCase):
    def setUp(self):
        self.auth = ClerkAuthentication()

    @override_settings(CLERK_JWKS_URL='https://trusted-clerk.example.com/.well-known/jwks.json')
    def test_get_trusted_jwks_url_prefers_explicit_url(self):
        self.assertEqual(
            self.auth._get_trusted_jwks_url(),
            'https://trusted-clerk.example.com/.well-known/jwks.json',
        )

    @override_settings(CLERK_JWKS_URL='', CLERK_ISSUER='https://issuer.clerk.example.com')
    def test_get_trusted_jwks_url_falls_back_to_issuer(self):
        self.assertEqual(
            self.auth._get_trusted_jwks_url(),
            'https://issuer.clerk.example.com/.well-known/jwks.json',
        )

    @override_settings(CLERK_ALLOWED_ISSUERS=['https://issuer.clerk.example.com'])
    def test_is_allowed_issuer_rejects_untrusted_issuer(self):
        self.assertFalse(
            self.auth._is_allowed_issuer('https://malicious.example.com'),
        )

    @override_settings(CLERK_ALLOWED_ISSUERS=['https://issuer.clerk.example.com'])
    def test_is_allowed_issuer_accepts_trusted_issuer(self):
        self.assertTrue(
            self.auth._is_allowed_issuer('https://issuer.clerk.example.com/'),
        )

    def test_validate_clerk_session_payload_requires_sub(self):
        self.assertFalse(self.auth._validate_clerk_session_payload({}))

    def test_validate_clerk_session_payload_rejects_wrong_token_type(self):
        self.assertFalse(
            self.auth._validate_clerk_session_payload(
                {'sub': 'user_123', 'type': 'id'},
            )
        )

    def test_validate_clerk_session_payload_accepts_session_token(self):
        self.assertTrue(
            self.auth._validate_clerk_session_payload(
                {'sub': 'user_123', 'type': 'session'},
            )
        )
