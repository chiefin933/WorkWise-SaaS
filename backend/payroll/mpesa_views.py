"""
M-Pesa B2C Callback Handlers
==============================
Safaricom posts B2C results to these endpoints after processing payments.
"""

import json
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from .models import MpesaTransaction

logger = logging.getLogger(__name__)


# ── Shared helper ─────────────────────────────────────────────────────────────

def _update_transaction(conversation_id: str, originator_id: str, result_code: str, result_desc: str):
    """Look up a MpesaTransaction by ID and update its status."""
    txn = (
        MpesaTransaction.objects.filter(conversation_id=conversation_id).first()
        or MpesaTransaction.objects.filter(originator_conversation_id=originator_id).first()
    )
    if txn:
        txn.result_code = result_code
        txn.result_desc = result_desc
        txn.status = "success" if result_code == "0" else "failed"
        txn.save(update_fields=["status", "result_code", "result_desc", "updated_at"])
        logger.info("Updated MpesaTransaction %s → status=%s", txn.id, txn.status)
    else:
        logger.warning(
            "No MpesaTransaction found for ConversationID=%s or OriginatorID=%s",
            conversation_id, originator_id,
        )
    return txn


# ── Result callback (primary success/failure from Safaricom) ──────────────────

class MpesaB2CResultView(APIView):
    """
    POST /api/mpesa/b2c/result/
    Receives the Daraja B2C result callback and updates MpesaTransaction records.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            print("🔔 M-Pesa callback received:")
            print(json.dumps(request.data, indent=2))

            result = request.data.get("Result", {})
            conversation_id = result.get("ConversationID", "")
            originator_id   = result.get("OriginatorConversationID", "")
            result_code     = str(result.get("ResultCode", ""))
            result_desc     = result.get("ResultDesc", "")

            logger.info(
                "🔔 M-Pesa B2C result callback: ConversationID=%s ResultCode=%s Desc=%s",
                conversation_id, result_code, result_desc,
            )

            _update_transaction(conversation_id, originator_id, result_code, result_desc)

            return Response({"ResultCode": 0, "ResultDesc": "Success"})

        except Exception as exc:
            logger.error("Error processing M-Pesa B2C result callback: %s", exc)
            return Response({"ResultCode": 1, "ResultDesc": "Server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Timeout callback (queue timeout from Safaricom) ───────────────────────────

class MpesaB2CTimeoutView(APIView):
    """
    POST /api/mpesa/b2c/timeout/
    Receives the Daraja B2C timeout callback when Safaricom's queue times out.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            print("⏰ M-Pesa timeout callback received:")
            print(request.data)

            result = request.data.get("Result", {})
            conversation_id = result.get("ConversationID", "")
            originator_id   = result.get("OriginatorConversationID", "")

            txn = (
                MpesaTransaction.objects.filter(conversation_id=conversation_id).first()
                or MpesaTransaction.objects.filter(originator_conversation_id=originator_id).first()
            )
            if txn:
                txn.status = "timeout"
                txn.result_desc = "Request timed out in Safaricom queue"
                txn.save(update_fields=["status", "result_desc", "updated_at"])
                logger.warning("Marked MpesaTransaction %s as timeout.", txn.id)

            return Response({"ResultCode": 0, "ResultDesc": "Success"})

        except Exception as exc:
            logger.error("Error processing M-Pesa B2C timeout callback: %s", exc)
            return Response({"ResultCode": 1, "ResultDesc": "Server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Legacy combined callback (kept for backward compat) ───────────────────────

class B2CCallbackView(APIView):
    """
    POST /api/mpesa/b2c/callback/   (legacy — prefer /result/ and /timeout/)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            result = request.data.get("Result", {})
            conversation_id = result.get("ConversationID", "")
            originator_id   = result.get("OriginatorConversationID", "")
            result_code     = str(result.get("ResultCode", ""))
            result_desc     = result.get("ResultDesc", "")

            logger.info(
                "M-Pesa B2C legacy callback: ConversationID=%s ResultCode=%s",
                conversation_id, result_code,
            )

            _update_transaction(conversation_id, originator_id, result_code, result_desc)

            return Response({"ResultCode": 0, "ResultDesc": "Success"})

        except Exception as exc:
            logger.error("Error processing M-Pesa B2C legacy callback: %s", exc)
            return Response({"ResultCode": 1, "ResultDesc": "Server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
