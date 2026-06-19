"""
Integration tests for the Clerk webhook HMAC signature verification.

Endpoint: POST /api/webhooks/clerk/
Security:  Svix library verifies svix-id / svix-timestamp / svix-signature headers.

These tests verify:
  - Missing SVIX headers → 400
  - Invalid / tampered signature → 401
  - Missing CLERK_WEBHOOK_SECRET setting → 500
  - Valid user.created event → tenant + user provisioned (201)
  - Valid user.created with pending invite → user linked (200)
  - Valid user.deleted event → user removed (200)
  - Unknown event type → 200 ignored
  - Duplicate user.created → idempotent (200, one user record)
  - Unauthenticated requests handled by signature check (no DRF auth)
"""
import json
import time
import uuid

from django.test import TestCase, override_settings
from rest_framework.test import APITestCase, APIClient

from tenants.models import Tenant
from users.models import User


WEBHOOK_URL = '/api/webhooks/clerk/'
TEST_SECRET = 'whsec_dGVzdF9zZWNyZXRfZm9yX3Rlc3Rpbmdfb25seQ=='  # base64 of a test key


def _build_svix_headers(secret: str, payload_bytes: bytes) -> dict:
    """
    Generate valid Svix signature headers for the given raw payload bytes.

    Uses the svix library's Webhook.sign() helper directly to produce headers
    that will pass Webhook.verify().
    """
    from svix.webhooks import Webhook

    msg_id = f'msg_{uuid.uuid4().hex}'
    timestamp = str(int(time.time()))

    # Build the signed content manually: "{msg_id}.{timestamp}.{body}"
    to_sign = f'{msg_id}.{timestamp}.{payload_bytes.decode("utf-8")}'.encode('utf-8')

    import hmac as _hmac
    import hashlib
    import base64

    # Decode the whsec_ secret (strip prefix, base64-decode)
    raw_secret = base64.b64decode(secret.replace('whsec_', ''))
    sig_bytes = _hmac.new(raw_secret, to_sign, hashlib.sha256).digest()
    sig_b64 = base64.b64encode(sig_bytes).decode()

    return {
        'HTTP_SVIX_ID': msg_id,
        'HTTP_SVIX_TIMESTAMP': timestamp,
        'HTTP_SVIX_SIGNATURE': f'v1,{sig_b64}',
    }


def _make_signed_request(client: APIClient, secret: str, payload_dict: dict):
    """Serialize payload, generate valid Svix headers, POST to webhook endpoint."""
    payload_bytes = json.dumps(payload_dict).encode('utf-8')
    headers = _build_svix_headers(secret, payload_bytes)
    return client.post(
        WEBHOOK_URL,
        data=payload_bytes,
        content_type='application/json',
        **headers,
    )


def _user_created_payload(
    clerk_id: str,
    email: str,
    first_name: str = 'Test',
    last_name: str = 'User',
    plan: str = 'GROWTH',
    company_name: str = 'Test Co',
) -> dict:
    return {
        'type': 'user.created',
        'data': {
            'id': clerk_id,
            'first_name': first_name,
            'last_name': last_name,
            'email_addresses': [{'email_address': email}],
            'unsafe_metadata': {
                'plan': plan,
                'companyName': company_name,
            },
        },
    }


def _user_deleted_payload(clerk_id: str) -> dict:
    return {
        'type': 'user.deleted',
        'data': {'id': clerk_id},
    }


@override_settings(CLERK_WEBHOOK_SECRET=TEST_SECRET)
class ClerkWebhookHMACTests(APITestCase):

    def setUp(self):
        self.client = APIClient()

    # ── Signature verification ─────────────────────────────────────────────────

    def test_missing_svix_headers_returns_400(self):
        """POST with no SVIX headers must be rejected with 400."""
        response = self.client.post(
            WEBHOOK_URL,
            data=json.dumps({'type': 'user.created', 'data': {}}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_signature_returns_401(self):
        """POST with wrong/tampered signature must be rejected with 401."""
        payload = json.dumps({'type': 'user.created', 'data': {}}).encode('utf-8')
        response = self.client.post(
            WEBHOOK_URL,
            data=payload,
            content_type='application/json',
            HTTP_SVIX_ID='msg_fake',
            HTTP_SVIX_TIMESTAMP=str(int(time.time())),
            HTTP_SVIX_SIGNATURE='v1,bm90YXJlYWxzaWduYXR1cmU=',  # invalid
        )
        self.assertEqual(response.status_code, 401)

    @override_settings(CLERK_WEBHOOK_SECRET=None)
    def test_missing_webhook_secret_returns_500(self):
        """If CLERK_WEBHOOK_SECRET is not configured, the endpoint must return 500."""
        # No valid signature possible; we just need to hit the secret-check branch
        payload = json.dumps({'type': 'user.created', 'data': {}}).encode('utf-8')
        response = self.client.post(
            WEBHOOK_URL,
            data=payload,
            content_type='application/json',
            HTTP_SVIX_ID='msg_any',
            HTTP_SVIX_TIMESTAMP=str(int(time.time())),
            HTTP_SVIX_SIGNATURE='v1,anything',
        )
        self.assertEqual(response.status_code, 500)

    # ── user.created ──────────────────────────────────────────────────────────

    def test_valid_user_created_event_provisions_tenant(self):
        """
        A valid signed user.created event must:
          - Return HTTP 201
          - Create a Tenant with the given companyName
          - Create a User linked to that tenant with role=ADMIN
        """
        clerk_id = f'user_{uuid.uuid4().hex}'
        email = 'newuser@example.com'

        response = _make_signed_request(
            self.client,
            TEST_SECRET,
            _user_created_payload(
                clerk_id=clerk_id,
                email=email,
                plan='GROWTH',
                company_name='Test Co',
            ),
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Tenant.objects.filter(name='Test Co').exists())
        user = User.objects.filter(email=email).first()
        self.assertIsNotNone(user, 'User was not created')
        self.assertEqual(user.role, 'ADMIN')
        self.assertEqual(user.clerk_id, clerk_id)

    def test_user_created_with_pending_invite_links_user(self):
        """
        If a pending (inactive) User with the same email and no clerk_id already
        exists (invite flow), the webhook must activate them rather than
        creating a new tenant/user.
        """
        tenant = Tenant.objects.create(name='Existing Corp', plan='GROWTH')
        token = uuid.uuid4().hex
        pending = User.objects.create_user(
            email='invited@existingcorp.com',
            tenant=tenant,
            role='HR',
            is_active=False,
            invite_token=token,
        )
        # Ensure clerk_id is None
        pending.clerk_id = None
        pending.save(update_fields=['clerk_id'])

        clerk_id = f'user_{uuid.uuid4().hex}'
        response = _make_signed_request(
            self.client,
            TEST_SECRET,
            _user_created_payload(
                clerk_id=clerk_id,
                email='invited@existingcorp.com',
                company_name='Ignored Corp',
            ),
        )

        self.assertEqual(response.status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.clerk_id, clerk_id)
        self.assertTrue(pending.is_active)
        # No second tenant should have been created
        self.assertFalse(Tenant.objects.filter(name='Ignored Corp').exists())

    # ── user.deleted ──────────────────────────────────────────────────────────

    def test_user_deleted_event_removes_user(self):
        """A valid signed user.deleted event must delete the matching user."""
        tenant = Tenant.objects.create(name='Delete Corp', plan='STARTER')
        clerk_id = f'user_{uuid.uuid4().hex}'
        User.objects.create_user(
            email='todelete@deletecorp.com',
            clerk_id=clerk_id,
            tenant=tenant,
            role='EMPLOYEE',
        )

        response = _make_signed_request(
            self.client, TEST_SECRET, _user_deleted_payload(clerk_id),
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(clerk_id=clerk_id).exists())

    # ── Unknown event type ────────────────────────────────────────────────────

    def test_unknown_event_type_returns_200_ignored(self):
        """Events the webhook doesn't handle must return 200 with status=ignored."""
        response = _make_signed_request(
            self.client,
            TEST_SECRET,
            {'type': 'session.created', 'data': {}},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ignored'})

    # ── Idempotency ───────────────────────────────────────────────────────────

    def test_duplicate_user_created_is_idempotent(self):
        """
        Sending the same user.created event twice must:
          - Return HTTP 200 on the second call (not 201)
          - Contain status='exists' in the response body
          - Leave exactly one User record in the database
        """
        clerk_id = f'user_{uuid.uuid4().hex}'
        email = f'dup_{clerk_id}@example.com'
        payload = _user_created_payload(
            clerk_id=clerk_id, email=email, company_name='Dup Co',
        )

        r1 = _make_signed_request(self.client, TEST_SECRET, payload)
        self.assertEqual(r1.status_code, 201)

        r2 = _make_signed_request(self.client, TEST_SECRET, payload)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json().get('status'), 'exists')

        self.assertEqual(User.objects.filter(email=email).count(), 1)
