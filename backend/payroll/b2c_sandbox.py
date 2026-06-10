"""
M-Pesa Daraja B2C Sandbox Helper
==================================
Handles OAuth token fetching and B2C salary payment requests
against the Safaricom sandbox (or production) environment.

SecurityCredential is read from MPESA_SECURITY_CREDENTIAL in settings/env.
If not set, a dynamic RSA-encrypted credential is attempted via the
cryptography library using the Safaricom sandbox certificate.
"""

import base64
import logging
import uuid

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


# ── Security Credential ───────────────────────────────────────────────────────

def _get_security_credential() -> str:
    """
    Return the M-Pesa SecurityCredential.

    Priority:
      1. MPESA_SECURITY_CREDENTIAL from Django settings / .env  (preferred)
      2. Dynamic RSA generation via the cryptography library (fallback)
    """
    # 1. Use pre-generated credential from settings
    cred = getattr(settings, 'MPESA_SECURITY_CREDENTIAL', '').strip()
    if cred:
        logger.debug("Using pre-configured MPESA_SECURITY_CREDENTIAL from settings.")
        return cred

    # 2. Fallback: generate dynamically (requires 'cryptography' installed)
    logger.warning(
        "MPESA_SECURITY_CREDENTIAL not set in settings. "
        "Attempting dynamic RSA generation (requires cryptography package)."
    )
    try:
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.x509 import load_pem_x509_certificate
        from cryptography.hazmat.backends import default_backend

        # Official Safaricom sandbox public certificate
        # Download from: https://developer.safaricom.co.ke (Daraja portal > Test Credentials)
        # Or generate SecurityCredential online at: https://developer.safaricom.co.ke/APIs/BusinessToCustomer
        cert_pem = getattr(settings, 'MPESA_SANDBOX_CERT', '').strip().encode()
        if not cert_pem:
            logger.error(
                "No MPESA_SANDBOX_CERT in settings. "
                "Set MPESA_SECURITY_CREDENTIAL in .env instead."
            )
            return ''

        cert = load_pem_x509_certificate(cert_pem, default_backend())
        password = getattr(settings, 'MPESA_INITIATOR_PASSWORD', 'Safaricom123!')
        encrypted = cert.public_key().encrypt(
            password.encode('utf-8'),
            padding.PKCS1v15(),
        )
        return base64.b64encode(encrypted).decode('utf-8')

    except ImportError:
        logger.error("cryptography package not installed. Run: pip install cryptography")
        return ''
    except Exception as exc:
        logger.error("Failed to generate SecurityCredential dynamically: %s", exc)
        return ''


# ── OAuth Token ───────────────────────────────────────────────────────────────

def get_mpesa_token() -> str:
    """Fetch a fresh OAuth2 access token from Safaricom Daraja."""
    env = getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox')
    base = (
        'https://sandbox.safaricom.co.ke'
        if env == 'sandbox'
        else 'https://api.safaricom.co.ke'
    )
    url = f"{base}/oauth/v1/generate?grant_type=client_credentials"
    response = requests.get(
        url,
        auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
        timeout=30,
    )
    response.raise_for_status()
    token = response.json()["access_token"]
    logger.info("M-Pesa OAuth token acquired successfully.")
    return token


# ── B2C URL ───────────────────────────────────────────────────────────────────

def _b2c_url() -> str:
    env = getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox')
    base = (
        'https://sandbox.safaricom.co.ke'
        if env == 'sandbox'
        else 'https://api.safaricom.co.ke'
    )
    return f"{base}/mpesa/b2c/v3/paymentrequest"


# ── B2C Payment ───────────────────────────────────────────────────────────────

def send_salary_payment(phone_number: str, amount, transaction_id: str) -> dict:
    """
    Send a B2C SalaryPayment to the given phone number.

    Args:
        phone_number:   Recipient in international format e.g. '254708374149'
        amount:         Amount in KES (int or float)
        transaction_id: Internal reference string

    Returns:
        Parsed JSON response dict from Daraja.
    """
    token = get_mpesa_token()
    security_credential = _get_security_credential()

    # Build a clean alphanumeric originator ID (max 20 chars)
    originator_id = ''.join(c for c in str(transaction_id) if c.isalnum())
    if not originator_id:
        originator_id = uuid.uuid4().hex[:16].upper()
    originator_id = originator_id[:20].upper()

    payload = {
        "OriginatorConversationID": originator_id,
        "InitiatorName": settings.MPESA_INITIATOR_NAME,
        "SecurityCredential": security_credential,
        "CommandID": "SalaryPayment",
        "Amount": str(int(float(amount))),
        "PartyA": settings.MPESA_B2C_SHORTCODE,
        "PartyB": phone_number,
        "Remarks": f"Salary {transaction_id}",
        "QueueTimeOutURL": settings.MPESA_B2C_TIMEOUT_URL,
        "ResultURL": settings.MPESA_B2C_RESULT_URL,
        "Occasion": str(transaction_id),
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    logger.info(
        "Sending B2C SalaryPayment → phone=%s  amount=%s  ref=%s",
        phone_number, amount, transaction_id,
    )

    response = requests.post(_b2c_url(), json=payload, headers=headers, timeout=30)

    try:
        data = response.json()
    except Exception:
        data = {"raw": response.text, "status_code": response.status_code}

    logger.info("Daraja B2C response: %s", data)
    return data
