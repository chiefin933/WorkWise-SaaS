import json
import logging
from django.conf import settings
from django_daraja.mpesa.core import MpesaClient
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status

from core.tenant_utils import tenant_required
from core.permissions import IsAdmin
from payroll.models import PayrollConfig
from .models import Tenant, MpesaSubscriptionPayment, TenantSettings
from .serializers import TenantSerializer, PayrollConfigSerializer, TenantSettingsSerializer

logger = logging.getLogger(__name__)


class CompanySettingsView(APIView):
    # Read access for all authenticated users; write access for ADMINs only.
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant, err = tenant_required(request)
        if err:
            return err
        return Response(TenantSerializer(tenant).data)

    def patch(self, request):
        if not IsAdmin().has_permission(request, self):
            return Response(
                {"error": "Only administrators can change company settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        tenant, err = tenant_required(request)
        if err:
            return err
        serializer = TenantSerializer(tenant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PayrollConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant, err = tenant_required(request)
        if err:
            return err
        config, _ = PayrollConfig.objects.get_or_create(tenant=tenant)
        return Response(PayrollConfigSerializer(config).data)

    def patch(self, request):
        if not IsAdmin().has_permission(request, self):
            return Response(
                {"error": "Only administrators can change payroll configuration."},
                status=status.HTTP_403_FORBIDDEN,
            )
        tenant, err = tenant_required(request)
        if err:
            return err
        config, _ = PayrollConfig.objects.get_or_create(tenant=tenant)
        serializer = PayrollConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TenantSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant, err = tenant_required(request)
        if err:
            return err
        settings, _ = TenantSettings.objects.get_or_create(tenant=tenant)
        return Response(TenantSettingsSerializer(settings).data)

    def patch(self, request):
        if not IsAdmin().has_permission(request, self):
            return Response(
                {"error": "Only administrators can change company settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        tenant, err = tenant_required(request)
        if err:
            return err
        settings, _ = TenantSettings.objects.get_or_create(tenant=tenant)
        serializer = TenantSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UpgradePlanView(APIView):
    """
    Staff-only endpoint to change a tenant's subscription plan.

    This endpoint is intentionally restricted to Django staff users to prevent
    tenants from self-upgrading without going through the M-Pesa payment flow.
    Plan upgrades from billing page use MpesaExpressPushView instead.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Only Django staff (is_staff=True) may directly override a plan.
        if not request.user.is_staff:
            return Response(
                {"error": "Plan upgrades must go through the billing payment flow."},
                status=status.HTTP_403_FORBIDDEN,
            )

        tenant, err = tenant_required(request)
        if err:
            return err

        plan = request.data.get('plan')
        if not plan:
            return Response({"error": "Plan is required."}, status=status.HTTP_400_BAD_REQUEST)

        from .models import Tenant
        valid_plans = [choice[0] for choice in Tenant.PLAN_CHOICES]
        if plan not in valid_plans:
            return Response({"error": f"Invalid plan: {plan}"}, status=status.HTTP_400_BAD_REQUEST)

        old_plan = tenant.plan
        tenant.plan = plan
        tenant.save()

        logger.info(
            "Staff user %s upgraded tenant %s plan from %s to %s.",
            request.user.email, tenant.id, old_plan, plan
        )
        return Response({
            "message": f"Plan successfully upgraded from {old_plan} to {plan}!",
            "plan": tenant.plan,
            "max_employees": tenant.max_employees
        })


class MpesaExpressPushView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != 'ADMIN':
            return Response(
                {"error": "Only administrators can initiate subscription payments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        tenant, err = tenant_required(request)
        if err:
            return err

        phone = request.data.get('phone')
        plan = request.data.get('plan')
        amount = request.data.get('amount')

        if not phone or not plan or not amount:
            return Response(
                {"error": "phone, plan, and amount are required fields."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Standardize phone number format for Safaricom (must start with 254)
        phone = phone.strip().replace('+', '')
        if phone.startswith('0'):
            phone = '254' + phone[1:]
        elif phone.startswith('7') or phone.startswith('1'):
            phone = '254' + phone

        if not phone.startswith('254') or len(phone) != 12:
            return Response(
                {"error": "Invalid Safaricom phone number. Must be in the format 2547XXXXXXXX or 2541XXXXXXXX."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate target plan
        valid_plans = [choice[0] for choice in Tenant.PLAN_CHOICES]
        if plan not in valid_plans:
            return Response(
                {"error": f"Invalid plan: {plan}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount_val = int(float(amount))
        except ValueError:
            return Response(
                {"error": "Invalid amount. Must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Trigger STK Push via django-daraja
        cl = MpesaClient()
        callback_url = getattr(settings, 'MPESA_STK_CALLBACK_URL', '')
        if not callback_url:
            if settings.DEBUG:
                # Developer convenience fallback for local testing only
                callback_url = 'https://almanac-hassle-remake.ngrok-free.dev/api/mpesa/stk-push-callback/'
            else:
                return Response({
                    "error": "MPESA_STK_CALLBACK_URL must be configured in the environment to initiate STK Push in production."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        try:
            response = cl.stk_push(
                phone_number=phone,
                amount=amount_val,
                account_reference=f"WW-{tenant.id.hex[:8].upper()}",
                transaction_desc=f"Payment for {plan} plan",
                callback_url=callback_url
            )

            response_code = getattr(response, 'response_code', None)
            if response_code is None:
                # Fallback if it is a dict
                response_code = response.get('ResponseCode')
                checkout_request_id = response.get('CheckoutRequestID')
                merchant_request_id = response.get('MerchantRequestID')
                response_description = response.get('ResponseDescription')
            else:
                checkout_request_id = getattr(response, 'checkout_request_id', '')
                merchant_request_id = getattr(response, 'merchant_request_id', '')
                response_description = getattr(response, 'response_description', '')

            if str(response_code) == '0':
                # Create the transaction record
                payment = MpesaSubscriptionPayment.objects.create(
                    tenant=tenant,
                    plan=plan,
                    phone_number=phone,
                    amount=amount_val,
                    status='pending',
                    merchant_request_id=merchant_request_id,
                    checkout_request_id=checkout_request_id
                )

                return Response({
                    "message": "STK Push initiated successfully. Please enter your PIN on your phone.",
                    "checkout_request_id": checkout_request_id,
                    "merchant_request_id": merchant_request_id,
                    "payment_id": str(payment.id)
                })
            else:
                return Response(
                    {"error": f"Failed to initiate STK Push: {response_description}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error("Error triggering M-Pesa STK Push: %s", e)
            return Response(
                {"error": f"Error initiating M-Pesa payment: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MpesaExpressStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        checkout_request_id = request.query_params.get('checkout_request_id')
        if not checkout_request_id:
            return Response(
                {"error": "checkout_request_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment = MpesaSubscriptionPayment.objects.filter(
            checkout_request_id=checkout_request_id,
            tenant=request.user.tenant
        ).first()

        if not payment:
            return Response(
                {"error": "Payment transaction not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            "id": str(payment.id),
            "status": payment.status,
            "plan": payment.plan,
            "amount": payment.amount,
            "result_desc": payment.result_desc
        })


class MpesaExpressCallbackView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            data = request.data
            logger.info("🔔 M-Pesa STK Callback received: %s", json.dumps(data, indent=2))
            print("🔔 STK Callback received:", data)

            body = data.get('Body', {})
            stk_callback = body.get('stkCallback', {})
            checkout_request_id = stk_callback.get('CheckoutRequestID')
            merchant_request_id = stk_callback.get('MerchantRequestID')
            result_code = stk_callback.get('ResultCode')
            result_desc = stk_callback.get('ResultDesc')

            payment = (
                MpesaSubscriptionPayment.objects.filter(checkout_request_id=checkout_request_id).first()
                or MpesaSubscriptionPayment.objects.filter(merchant_request_id=merchant_request_id).first()
            )

            if payment:
                payment.result_code = str(result_code)
                payment.result_desc = result_desc

                if result_code == 0:
                    payment.status = 'success'
                    payment.save()

                    tenant = payment.tenant
                    old_plan = tenant.plan
                    tenant.plan = payment.plan
                    tenant.subscription_status = Tenant.STATUS_ACTIVE
                    tenant.save()

                    logger.info(
                        "✅ M-Pesa STK Push Payment Success: Tenant %s upgraded from %s to %s",
                        tenant.name, old_plan, payment.plan
                    )
                else:
                    payment.status = 'failed'
                    payment.save()
                    logger.warning(
                        "❌ M-Pesa STK Push Payment Failed/Cancelled: CheckoutRequestID=%s ResultCode=%s Desc=%s",
                        checkout_request_id, result_code, result_desc
                    )

                return Response({"ResultCode": 0, "ResultDesc": "Success"})
            else:
                logger.warning(
                    "No MpesaSubscriptionPayment found for CheckoutRequestID=%s or MerchantRequestID=%s",
                    checkout_request_id, merchant_request_id
                )
                return Response({"ResultCode": 1, "ResultDesc": "Transaction not found"}, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.error("Error processing M-Pesa STK Callback: %s", e)
            return Response({"ResultCode": 1, "ResultDesc": "Server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RolePermissionsView(APIView):
    """
    GET  /api/settings/role-permissions/
         Returns effective permissions per role + the full permission catalogue.

    PATCH /api/settings/role-permissions/
         Payload: { "role": "HR", "added": ["payroll.approve"], "removed": ["employee.delete"] }
         ADMIN only.

    POST  /api/settings/role-permissions/reset/
         Payload: { "role": "HR" }
         Resets a role back to its defaults.  ADMIN only.
    """
    permission_classes = [IsAuthenticated]

    def _get_rp(self, tenant):
        from core.role_permissions_model import RolePermission
        rp, _ = RolePermission.objects.get_or_create(tenant=tenant)
        return rp

    def get(self, request):
        from core.rbac import PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, get_role_permissions

        tenant, err = tenant_required(request)
        if err:
            return err

        rp = self._get_rp(tenant)

        roles = ['HR', 'FINANCE', 'EMPLOYEE']
        role_data = {}
        for role in roles:
            effective = set(get_role_permissions(role, rp.permissions))
            default   = DEFAULT_ROLE_PERMISSIONS.get(role, set())
            overrides = rp.permissions.get(role, {})
            role_data[role] = {
                'effective':  sorted(effective),
                'default':    sorted(default),
                'added':      sorted(overrides.get('added',   [])),
                'removed':    sorted(overrides.get('removed', [])),
            }

        # Group catalogue by module prefix
        catalogue = {}
        for perm, desc in PERMISSIONS.items():
            module = perm.split('.')[0]
            catalogue.setdefault(module, []).append({'key': perm, 'description': desc})

        return Response({'roles': role_data, 'catalogue': catalogue})

    def patch(self, request):
        if not IsAdmin().has_permission(request, self):
            return Response(
                {'error': 'Only administrators can modify role permissions.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        from core.rbac import PERMISSIONS

        tenant, err = tenant_required(request)
        if err:
            return err

        role    = request.data.get('role', '').upper()
        added   = request.data.get('added', [])
        removed = request.data.get('removed', [])

        if role not in ('HR', 'FINANCE', 'EMPLOYEE'):
            return Response({'error': 'Role must be HR, FINANCE, or EMPLOYEE.'}, status=400)

        unknown = [p for p in added + removed if p not in PERMISSIONS]
        if unknown:
            return Response({'error': f'Unknown permissions: {", ".join(unknown)}'}, status=400)

        rp = self._get_rp(tenant)
        overrides = rp.permissions.get(role, {'added': [], 'removed': []})
        overrides['added']   = sorted(set(overrides.get('added',   []) + added)   - set(removed))
        overrides['removed'] = sorted(set(overrides.get('removed', []) + removed) - set(added))
        rp.permissions[role] = overrides
        rp.save(update_fields=['permissions', 'updated_at'])

        logger.info(
            "Role permissions updated for tenant %s role %s by %s — added=%s removed=%s",
            tenant.name, role, request.user.email, added, removed,
        )
        return Response({'message': f'{role} permissions updated.', 'overrides': overrides})

    def post(self, request):
        """Reset a role to its defaults."""
        if not IsAdmin().has_permission(request, self):
            return Response(
                {'error': 'Only administrators can reset role permissions.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tenant, err = tenant_required(request)
        if err:
            return err

        role = request.data.get('role', '').upper()
        if role not in ('HR', 'FINANCE', 'EMPLOYEE'):
            return Response({'error': 'Role must be HR, FINANCE, or EMPLOYEE.'}, status=400)

        rp = self._get_rp(tenant)
        rp.reset_role(role)

        logger.info(
            "Role permissions reset to defaults for tenant %s role %s by %s",
            tenant.name, role, request.user.email,
        )
        return Response({'message': f'{role} permissions reset to defaults.'})
