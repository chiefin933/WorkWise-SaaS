import uuid
import requests as _http

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from rest_framework import permissions, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import status as http_status
from .serializers import UserSerializer, NotificationSerializer
from .models import User, Notification
import logging

logger = logging.getLogger(__name__)


def _get_client_ip(request) -> str | None:
    """Extract the real client IP, honouring X-Forwarded-For from a trusted proxy."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _resolve_location(ip: str | None) -> str:
    """
    Reverse-geocode an IP address to a human-readable location string.
    Uses ip-api.com (free, no key required, 45 req/min).
    Returns a fallback string if the lookup fails or the IP is private.
    """
    if not ip or ip in ('127.0.0.1', '::1', 'localhost'):
        return 'Local / Development'
    try:
        resp = _http.get(
            f'http://ip-api.com/json/{ip}',
            params={'fields': 'status,city,regionName,country'},
            timeout=3,
        )
        data = resp.json()
        if data.get('status') == 'success':
            parts = [data.get('city'), data.get('regionName'), data.get('country')]
            return ', '.join(p for p in parts if p)
    except Exception as exc:
        logger.debug("IP geolocation failed for %s: %s", ip, exc)
    return 'Unknown location'


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)

        # Write a LOGIN audit entry so admins can see who signed in, from where,
        # and with what role.  We write this on every /users/me/ call because
        # that's the first authenticated request made by the frontend after Clerk
        # resolves the session — effectively the "session start" event.
        try:
            from core.audit import log_action, AuditAction
            ip = _get_client_ip(request)
            location = _resolve_location(ip)
            log_action(
                action=AuditAction.LOGIN,
                actor_id=str(request.user.pk),
                actor_email=request.user.email,
                tenant=request.user.tenant,
                resource_type='User',
                resource_id=str(request.user.pk),
                ip_address=ip,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:512],
                after={
                    'role': request.user.role,
                    'location': location,
                },
            )
        except Exception as exc:
            logger.debug("Failed to write LOGIN audit log: %s", exc)

        return Response(serializer.data)

    def patch(self, request):
        user = request.user

        # Prevent privilege escalation — only admins can change roles
        if 'role' in request.data and user.role != 'ADMIN':
            return Response(
                {"error": "You do not have permission to change roles."},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        serializer = UserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info("User profile updated: pk=%s", user.pk)
        return Response(serializer.data)


class NotificationSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(request.user.notification_preferences or {})

    def patch(self, request):
        user = request.user
        new_prefs = request.data
        if 'notification_preferences' in request.data:
            new_prefs = request.data['notification_preferences']

        if not isinstance(new_prefs, dict):
            return Response({"error": "Invalid data format. Expected dictionary."}, status=http_status.HTTP_400_BAD_REQUEST)

        current_prefs = user.notification_preferences or {}
        current_prefs.update(new_prefs)
        user.notification_preferences = current_prefs
        user.save(update_fields=['notification_preferences'])

        logger.info("Notification preferences updated for user: pk=%s", user.pk)
        return Response(user.notification_preferences)



class InviteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        role = (request.data.get('role') or '').strip().upper()

        if not email:
            return Response({"error": "Email is required."}, status=http_status.HTTP_400_BAD_REQUEST)
        if role not in ('HR', 'EMPLOYEE'):
            return Response({"error": "Role must be HR or EMPLOYEE."}, status=http_status.HTTP_400_BAD_REQUEST)

        tenant = request.user.tenant
        if not tenant:
            return Response({"error": "Your user is not linked to a workspace."}, status=http_status.HTTP_400_BAD_REQUEST)

        existing = User.objects.filter(email__iexact=email, tenant=tenant).first()
        if existing and existing.is_active:
            return Response(
                {"error": "An active user with this email already exists in your workspace."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if existing and not existing.is_active:
            return Response(
                {"error": "An invite is already pending for this email."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(email__iexact=email).exclude(tenant=tenant).exists():
            # Do NOT reveal that the email exists in another tenant — that leaks
            # cross-tenant information. Silently allow the invite to proceed;
            # Clerk will handle duplicate email enforcement at sign-up time.
            pass

        invite_token = str(uuid.uuid4())
        invited_user = User.objects.create_user(
            email=email,
            tenant=tenant,
            role=role,
            is_active=False,
            invite_token=invite_token,
        )

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        invite_link = f'{frontend_url}/auth/accept-invite?token={invite_token}&email={email}'
        admin_name = request.user.get_full_name() or request.user.email
        role_display = 'HR Manager' if role == 'HR' else 'Employee'

        # Use the company name as the sender tag so recipients know who invited them
        company_from_email = f"{tenant.name} via WorkWise <noreply@workwise.co.ke>"

        send_mail(
            subject=f"You've been invited to join {tenant.name} on WorkWise",
            message=(
                "Hi,\n\n"
                f"{admin_name} has invited you to join {tenant.name} as {role_display} on WorkWise — "
                "Kenya's HR & Payroll platform.\n\n"
                "Click the link below to accept your invitation and create your account:\n\n"
                f"{invite_link}\n\n"
                f"Sign up with this email address ({email}) to activate your account.\n\n"
                "This invitation link is unique to you — please do not share it.\n"
                "If you did not expect this invitation, you can safely ignore this email.\n\n"
                f"— The {tenant.name} Team"
            ),
            from_email=company_from_email,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(
            {
                "id": str(invited_user.id),
                "email": invited_user.email,
                "role": invited_user.role,
                "invite_pending": True,
            },
            status=http_status.HTTP_201_CREATED,
        )


class TeamMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        members = User.objects.filter(tenant=request.user.tenant).order_by('role', 'email')
        return Response([
            {
                "id": str(member.id),
                "email": member.email,
                "first_name": member.first_name,
                "last_name": member.last_name,
                "role": member.role,
                "is_active": member.is_active,
                "invite_pending": member.clerk_id is None,
            }
            for member in members
        ])


class RevokeInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def delete(self, request, pk):
        try:
            invited_user = User.objects.get(id=pk, tenant=request.user.tenant)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=http_status.HTTP_404_NOT_FOUND)

        if invited_user.clerk_id:
            return Response(
                {"error": "This invite has already been accepted."},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        invited_user.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class InviteInfoView(APIView):
    """
    Public endpoint — no authentication required.

    Returns minimal invite metadata given a token so the /auth/accept-invite
    page can pre-fill the sign-up form (email, role, company name) without
    the user being logged in yet.

    GET /api/users/invite/info/?token=<uuid>
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get('token', '').strip()
        if not token:
            return Response(
                {"error": "token query parameter is required."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            invited_user = User.objects.select_related('tenant').get(
                invite_token=token,
                is_active=False,
                clerk_id__isnull=True,  # Not yet accepted
            )
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid or expired invitation token."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        return Response({
            "email": invited_user.email,
            "role": invited_user.role,
            "company": invited_user.tenant.name if invited_user.tenant else None,
        })


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Enforce scope: current user and user's tenant
        queryset = Notification.objects.filter(
            tenant=self.request.user.tenant,
            recipient=self.request.user
        )
        unread = self.request.query_params.get('unread')
        if unread and unread.lower() == 'true':
            queryset = queryset.filter(is_read=False)
        return queryset.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        limit = request.query_params.get('limit')
        if limit:
            try:
                limit = int(limit)
                queryset = queryset[:limit]
            except ValueError:
                pass
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # Auto-set tenant and recipient if created via API (though usually created by signals)
        serializer.save(
            tenant=self.request.user.tenant,
            recipient=self.request.user
        )

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['post'], url_path='read-all')
    def read_all(self, request):
        queryset = self.get_queryset().filter(is_read=False)
        count = queryset.update(is_read=True)
        return Response({"message": f"Marked {count} notifications as read."})

