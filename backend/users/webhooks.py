import logging
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.conf import settings
from .models import User
from tenants.models import Tenant
from payroll.models import PayrollConfig

logger = logging.getLogger(__name__)


class ClerkWebhookView(APIView):
    """
    Receives Clerk webhook events and provisions users/tenants accordingly.
    Verifies the request signature using the Svix library to ensure authenticity.
    """
    permission_classes = []  # Public — auth done via signature check below

    def post(self, request):
        # --- Mandatory Signature Verification ---
        webhook_secret = getattr(settings, 'CLERK_WEBHOOK_SECRET', None)
        if not webhook_secret:
            logger.error("Security Halt: CLERK_WEBHOOK_SECRET is not configured in settings.")
            return Response(
                {"error": "Webhook engine misconfigured"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        svix_id = request.META.get("HTTP_SVIX_ID")
        svix_timestamp = request.META.get("HTTP_SVIX_TIMESTAMP")
        svix_signature = request.META.get("HTTP_SVIX_SIGNATURE")

        if not all([svix_id, svix_timestamp, svix_signature]):
            logger.warning("Clerk webhook rejected: Missing signature headers.")
            return Response(
                {"error": "Missing mandatory webhook signatures"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from svix.webhooks import Webhook, WebhookVerificationError
            wh = Webhook(webhook_secret)
            headers = {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            }
            # Svix needs the raw bytes of the request body
            wh.verify(request.body, headers)
        except WebhookVerificationError as e:
            logger.error(f"Security Alert: Forged or invalid Clerk webhook signature attempt: {e}")
            return Response(
                {"error": "Invalid cryptographic signature"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"Unexpected error during webhook signature verification: {e}")
            return Response(
                {"error": "Signature verification error"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- Event Handling ---
        payload = request.data
        event_type = payload.get("type")
        logger.info(f"Received Clerk webhook event: {event_type}")

        if event_type == "user.created":
            return self._handle_user_created(payload.get("data", {}))

        if event_type == "user.deleted":
            return self._handle_user_deleted(payload.get("data", {}))

        return Response({"status": "ignored"}, status=status.HTTP_200_OK)

    @transaction.atomic
    def _handle_user_created(self, data: dict):
        clerk_id = data.get("id")
        emails = data.get("email_addresses", [])
        if not emails:
            return Response({"error": "No email provided"}, status=status.HTTP_400_BAD_REQUEST)

        email = emails[0].get("email_address")
        first_name = data.get("first_name", "") or ""
        last_name = data.get("last_name", "") or ""

        if User.objects.filter(clerk_id=clerk_id).exists():
            logger.info(f"User with clerk_id {clerk_id} already exists, skipping creation.")
            return Response({"status": "exists"}, status=status.HTTP_200_OK)

        pending_invite = User.objects.filter(
            email__iexact=email,
            clerk_id__isnull=True,
            is_active=False,
        ).first()
        if pending_invite:
            pending_invite.clerk_id = clerk_id
            pending_invite.first_name = first_name
            pending_invite.last_name = last_name
            pending_invite.is_active = True
            pending_invite.invite_token = None
            pending_invite.save(update_fields=[
                'clerk_id',
                'first_name',
                'last_name',
                'is_active',
                'invite_token',
            ])
            logger.info(
                "Linked invited user %s to existing tenant %s.",
                pending_invite.email,
                pending_invite.tenant_id,
            )
            return Response({"status": "invited user linked"}, status=status.HTTP_200_OK)

        # Read plan and company name from Clerk unsafeMetadata (set by custom registration form)
        unsafe_meta = data.get("unsafe_metadata", {})
        plan = (unsafe_meta.get("plan") or "STARTER").upper()
        company_name = (unsafe_meta.get("companyName") or "").strip()

        # Validate plan choice
        valid_plans = ["STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"]
        if plan not in valid_plans:
            plan = "STARTER"

        # Use company name from form, fallback to "FirstName's Organization"
        tenant_name = company_name or (f"{first_name}'s Organization".strip() if first_name else "New Organization")

        # Create Tenant with chosen plan
        tenant = Tenant.objects.create(name=tenant_name, plan=plan)

        # Default Payroll Config
        PayrollConfig.objects.create(tenant=tenant)

        # Create the User record linked to Clerk
        User.objects.create_user(
            email=email,
            clerk_id=clerk_id,
            first_name=first_name,
            last_name=last_name,
            tenant=tenant,
            role="ADMIN",
        )

        logger.info(f"Created new user {email} with tenant '{tenant_name}' on plan '{plan}'.")
        return Response({"status": "user created"}, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def _handle_user_deleted(self, data: dict):
        clerk_id = data.get("id")
        try:
            user = User.objects.get(clerk_id=clerk_id)
            email = user.email
            user.delete()
            logger.info(f"Deleted user {email} (clerk_id={clerk_id}).")
        except User.DoesNotExist:
            logger.warning(f"user.deleted event for unknown clerk_id: {clerk_id}")
        return Response({"status": "user deleted"}, status=status.HTTP_200_OK)
