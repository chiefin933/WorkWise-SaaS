import types
from contextlib import contextmanager
from unittest.mock import patch

from django.test import override_settings, SimpleTestCase
from jose.exceptions import JWTError

from core.authentication import ClerkAuthentication


def make_dummy_jwt(kid='KID123', claims=None):
    claims = claims or {
        'iss': 'https://clerk.example',
        'aud': 'api://workwise',
        'sub': 'clerk_123',
        'type': 'session',
    }
    jwt_module = types.ModuleType('jose.jwt')

    def get_unverified_header(token):
        return {'kid': kid}

    def get_unverified_claims(token):
        return claims

    def decode(token, key, algorithms, audience, issuer):
        if claims.get('iss') != issuer:
            raise JWTError('Invalid issuer')
        aud = claims.get('aud')
        if isinstance(aud, list):
            audience_matches = audience in aud
        else:
            audience_matches = aud == audience
        if not audience_matches:
            raise JWTError('Invalid audience')
        return claims

    jwt_module.get_unverified_header = get_unverified_header
    jwt_module.get_unverified_claims = get_unverified_claims
    jwt_module.decode = decode
    jwt_module.JWTError = Exception
    jwt_module.ExpiredSignatureError = Exception

    return jwt_module


@contextmanager
def patched_jwt(dummy_jwt):
    with patch('jose.jwt.get_unverified_header', dummy_jwt.get_unverified_header):
        with patch('jose.jwt.get_unverified_claims', dummy_jwt.get_unverified_claims):
            with patch('jose.jwt.decode', dummy_jwt.decode):
                yield


class ClerkAuthenticationTests(SimpleTestCase):
    def test_verify_token_rejects_missing_issuer(self):
        with override_settings(
            CLERK_ISSUER='https://clerk.example',
            CLERK_AUDIENCE='api://workwise',
            CLERK_JWKS_URL='https://trusted.example/jwks.json',
        ):
            token = make_dummy_jwt(claims={'aud': 'api://workwise', 'sub': 'clerk_123'})
            with patched_jwt(token):
                with patch('core.authentication.ClerkAuthentication._get_public_key') as get_key:
                    auth = ClerkAuthentication()
                    self.assertIsNone(auth._verify_clerk_token('dummy-token'))
                    get_key.assert_not_called()

    def test_verify_token_rejects_mismatched_issuer(self):
        with override_settings(
            CLERK_ISSUER='https://clerk.example',
            CLERK_AUDIENCE='api://workwise',
            CLERK_JWKS_URL='https://trusted.example/jwks.json',
        ):
            token = make_dummy_jwt(claims={
                'iss': 'https://attacker.example',
                'aud': 'api://workwise',
                'sub': 'clerk_123',
                'type': 'session',
            })
            with patched_jwt(token):
                with patch('core.authentication.ClerkAuthentication._get_public_key') as get_key:
                    auth = ClerkAuthentication()
                    self.assertIsNone(auth._verify_clerk_token('dummy-token'))
                    get_key.assert_not_called()

    def test_verify_token_fails_without_audience(self):
        with override_settings(CLERK_ISSUER='https://clerk.example', CLERK_AUDIENCE=''):
            with patched_jwt(make_dummy_jwt()):
                auth = ClerkAuthentication()
                self.assertIsNone(auth._verify_clerk_token('dummy-token'))

    def test_verify_token_rejects_missing_token_audience(self):
        with override_settings(
            CLERK_ISSUER='https://clerk.example',
            CLERK_AUDIENCE='api://workwise',
            CLERK_JWKS_URL='https://trusted.example/jwks.json',
        ):
            token = make_dummy_jwt(claims={
                'iss': 'https://clerk.example',
                'sub': 'clerk_123',
                'type': 'session',
            })
            with patch('core.authentication.ClerkAuthentication._get_public_key', return_value='PUB'):
                with patched_jwt(token):
                    auth = ClerkAuthentication()
                    self.assertIsNone(auth._verify_clerk_token('dummy-token'))

    def test_verify_token_rejects_mismatched_token_audience(self):
        with override_settings(
            CLERK_ISSUER='https://clerk.example',
            CLERK_AUDIENCE='api://workwise',
            CLERK_JWKS_URL='https://trusted.example/jwks.json',
        ):
            token = make_dummy_jwt(claims={
                'iss': 'https://clerk.example',
                'aud': 'api://other-service',
                'sub': 'clerk_123',
                'type': 'session',
            })
            with patch('core.authentication.ClerkAuthentication._get_public_key', return_value='PUB'):
                with patched_jwt(token):
                    auth = ClerkAuthentication()
                    self.assertIsNone(auth._verify_clerk_token('dummy-token'))

    def test_verify_token_uses_configured_jwks_url_not_token_issuer_discovery(self):
        with override_settings(
            CLERK_ISSUER='',
            CLERK_ALLOWED_ISSUERS=['https://clerk.example'],
            CLERK_AUDIENCE='api://workwise',
            CLERK_JWKS_URL='https://trusted.example/static-jwks.json',
        ):
            with patch('core.authentication.ClerkAuthentication._get_public_key', return_value='PUB') as get_key:
                with patched_jwt(make_dummy_jwt()):
                    auth = ClerkAuthentication()
                    self.assertEqual(auth._verify_clerk_token('dummy-token'), 'clerk_123')
                    get_key.assert_called_once_with('https://trusted.example/static-jwks.json', 'KID123')

    def test_verify_token_succeeds_with_issuer_and_audience(self):
        with override_settings(
            CLERK_ISSUER='https://clerk.example',
            CLERK_AUDIENCE='api://workwise',
            CLERK_JWKS_URL='https://clerk.example/.well-known/jwks.json',
        ):
            with patch('core.authentication.ClerkAuthentication._get_public_key', return_value='PUB'):
                with patched_jwt(make_dummy_jwt()):
                    auth = ClerkAuthentication()
                    self.assertEqual(auth._verify_clerk_token('dummy-token'), 'clerk_123')
