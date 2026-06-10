"""
Safaricom Daraja B2C Client
===========================
Handles OAuth token generation and B2C payment initiation.

Simulation Mode (default, MPESA_ENABLED=False):
    No real API calls are made. Transactions are created immediately with
    mock conversation IDs and automatically marked 'success' after a short delay.

Production Mode (MPESA_ENABLED=True):
    Requires valid Daraja credentials in environment variables.
    Sandbox: https://sandbox.safaricom.co.ke
    Live:    https://api.safaricom.co.ke (set MPESA_SANDBOX=False)
"""

import uuid
import base64
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class DarajaClient:
    SANDBOX_BASE = "https://sandbox.safaricom.co.ke"
    LIVE_BASE = "https://api.safaricom.co.ke"

    def __init__(self):
        self.consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', '')
        self.consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', '')
        self.shortcode = getattr(settings, 'MPESA_SHORTCODE', '600000')
        self.initiator_name = getattr(settings, 'MPESA_INITIATOR_NAME', 'testapi')
        self.security_credential = getattr(settings, 'MPESA_SECURITY_CREDENTIAL', '')
        self.result_url = getattr(settings, 'MPESA_B2C_RESULT_URL', '')
        self.timeout_url = getattr(settings, 'MPESA_B2C_TIMEOUT_URL', '')
        self.sandbox = getattr(settings, 'MPESA_SANDBOX', True)
        self.base_url = self.SANDBOX_BASE if self.sandbox else self.LIVE_BASE
        self._access_token = None

        if not self.security_credential and self.sandbox:
            try:
                from .b2c_sandbox import _get_security_credential
                self.security_credential = _get_security_credential()
                logger.info("Auto-generated sandbox M-Pesa SecurityCredential dynamically.")
            except Exception as e:
                logger.warning("Could not auto-generate sandbox security credential: %s", e)

    def get_access_token(self) -> str:
        """Fetch OAuth2 access token from Daraja."""
        credentials = f"{self.consumer_key}:{self.consumer_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        response = requests.get(
            url,
            headers={"Authorization": f"Basic {encoded}"},
            timeout=10
        )
        response.raise_for_status()
        self._access_token = response.json()['access_token']
        return self._access_token

    def b2c_payment(self, phone: str, amount: float, remarks: str = "Salary Disbursement") -> dict:
        """
        Initiate a B2C payment request.
        Returns the Daraja response dict with ConversationID and OriginatorConversationID.
        """
        if not self._access_token:
            self.get_access_token()

        # Normalize phone: ensure it starts with 254
        phone = phone.strip().lstrip('+')
        if phone.startswith('0'):
            phone = '254' + phone[1:]

        originator_id = str(uuid.uuid4()).replace('-', '')[:16].upper()

        # Ensure callback URLs are set in production
        if not self.result_url or not self.timeout_url:
            if not self.sandbox:
                raise ValueError("MPESA_B2C_RESULT_URL and MPESA_B2C_TIMEOUT_URL must be configured in production.")
            else:
                logger.warning("MPesa B2C: callback URLs not configured; running in sandbox with no callbacks set.")

        payload = {
            "OriginatorConversationID": originator_id,
            "InitiatorName": self.initiator_name,
            "SecurityCredential": self.security_credential,
            "CommandID": "SalaryPayment",
            "Amount": int(round(float(amount))),
            "PartyA": self.shortcode,
            "PartyB": phone,
            "Remarks": remarks,
            "QueueTimeOutURL": self.timeout_url,
            "ResultURL": self.result_url,
            "Occassion": "Monthly Payroll",
        }

        url = f"{self.base_url}/mpesa/b2c/v3/paymentrequest"
        response = requests.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {self._access_token}",
                "Content-Type": "application/json",
            },
            timeout=15
        )
        response.raise_for_status()
        return response.json()


def simulate_b2c_payment(phone: str, amount: float) -> dict:
    """
    Simulation mode: returns a mock Daraja response without making real API calls.
    Transactions will be auto-marked 'success' immediately.
    """
    mock_id = str(uuid.uuid4()).replace('-', '')[:16].upper()
    return {
        "ConversationID": f"AG_{mock_id}_SIM",
        "OriginatorConversationID": f"SIM-{mock_id}",
        "ResponseCode": "0",
        "ResponseDescription": "Accept the service request successfully.",
        "_simulated": True,
    }
