import time
from django.test import SimpleTestCase, override_settings

from core.authentication import ClerkAuthentication

try:
    from jose import jwt
except Exception:  # pragma: no cover - jose should be available in the project's env
    jwt = None

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization


class ClerkJWKSIntegrationTests(SimpleTestCase):
    @override_settings(
        CLERK_AUDIENCE='my-audience',
        CLERK_ALLOWED_ISSUERS=['https://issuer.clerk.example.com'],
        CLERK_JWKS_URL='https://example.invalid/.well-known/jwks.json',
    )
    def test_verify_clerk_token_with_signed_rs256_token(self):
        if jwt is None:
            self.skipTest('python-jose not available in test environment')

        # Generate an ephemeral RSA key for signing
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

        kid = 'test-kid'
        payload = {
            'sub': 'user_ABC123',
            'iss': 'https://issuer.clerk.example.com',
            'aud': 'my-audience',
            'type': 'session',
            'exp': int(time.time()) + 300,
        }

        token = jwt.encode(payload, private_pem, algorithm='RS256', headers={'kid': kid})

        auth = ClerkAuthentication()

        # Patch the method that would fetch and parse JWKS to return the public PEM
        original_get_public_key = auth._get_public_key

        try:
            auth._get_public_key = lambda jwks_url, _kid: public_pem
            sub = auth._verify_clerk_token(token)
            self.assertEqual(sub, 'user_ABC123')
        finally:
            auth._get_public_key = original_get_public_key
