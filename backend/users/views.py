import uuid
import secrets
import string
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


def _generate_temp_password(length: int = 12) -> str:
    """
    Generate a secure temporary password that meets Clerk's requirements:
    - At least 8 characters
    - Mix of uppercase, lowercase, digits, and special characters
    Format: Xxxx-0000-Xx! (readable but secure)
    """
    alphabet = string.ascii_letters + string.digits
    special = '!@#$%'
    # Guarantee at least one of each required type
    pwd = (
        secrets.choice(string.ascii_uppercase) +
        secrets.choice(string.ascii_lowercase) +
        secrets.choice(string.digits) +
        secrets.choice(special) +
        ''.join(secrets.choice(alphabet) for _ in range(length - 4))
    )
    # Shuffle to avoid predictable pattern
    pwd_list = list(pwd)
    secrets.SystemRandom().shuffle(pwd_list)
    return ''.join(pwd_list)


def _create_clerk_user(email: str, password: str, first_name: str = '', last_name: str = '') -> str | None:
    """
    Create a user in Clerk via the Backend API and return their clerk_id.
    Returns None if Clerk API is not configured or the call fails.
    """
    secret_key = getattr(settings, 'CLERK_SECRET_KEY', '')
    if not secret_key:
        logger.warning("CLERK_SECRET_KEY not set — skipping Clerk user creation for invite.")
        return None

    try:
        resp = _http.post(
            'https://api.clerk.com/v1/users',
            headers={
                'Authorization': f'Bearer {secret_key}',
                'Content-Type': 'application/json',
            },
            json={
                'email_address': [email],
                'password': password,
                'first_name': first_name or '',
                'last_name': last_name or '',
                'skip_password_checks': True,
                'skip_password_requirement': False,
                # Mark email as verified so the temp password works immediately
                # without Clerk forcing an email verification step first
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            clerk_id = data.get('id')
            # Check if Clerk requires email verification before the password works
            needs_verification = any(
                addr.get('verification', {}).get('status') != 'verified'
                for addr in data.get('email_addresses', [])
            )
            if needs_verification:
                logger.warning(
                    "Clerk user created but email is unverified for %s — "
                    "attempting to verify email automatically...", email
                )
                # Auto-verify the email so the temp password works immediately
                email_id = data['email_addresses'][0].get('id') if data.get('email_addresses') else None
                if email_id:
                    verify_resp = _http.patch(
                        f'https://api.clerk.com/v1/email_addresses/{email_id}',
                        headers={
                            'Authorization': f'Bearer {secret_key}',
                            'Content-Type': 'application/json',
                        },
                        json={'verified': True},
                        timeout=10,
                    )
                    if verify_resp.status_code == 200:
                        logger.info("Email auto-verified for invited user: %s", email)
                    else:
                        logger.warning(
                            "Email auto-verify failed for %s: %s",
                            email, verify_resp.text[:200]
                        )
            logger.info("Clerk user created for invite: %s (id=%s)", email, clerk_id)
            return clerk_id
        else:
            logger.warning(
                "Clerk user creation failed for %s: %s %s",
                email, resp.status_code, resp.text[:200]
            )
            return None
    except Exception as exc:
        logger.error("Clerk API call failed during invite: %s", exc)
        return None


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
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()

        if not email:
            return Response({"error": "Email is required."}, status=http_status.HTTP_400_BAD_REQUEST)
        if role not in ('HR', 'FINANCE', 'EMPLOYEE'):
            return Response({"error": "Role must be HR, FINANCE, or EMPLOYEE."}, status=http_status.HTTP_400_BAD_REQUEST)

        tenant = request.user.tenant
        if not tenant:
            return Response({"error": "Your user is not linked to a workspace."}, status=http_status.HTTP_400_BAD_REQUEST)

        # Check for existing active user in this tenant
        existing = User.objects.filter(email__iexact=email, tenant=tenant).first()
        if existing and existing.is_active:
            return Response(
                {"error": "An active user with this email already exists in your workspace."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if existing and not existing.is_active:
            # Re-send invite for pending invites
            existing.delete()

        # Generate a secure temporary password
        temp_password = _generate_temp_password()

        # Create the user in Clerk via Backend API
        clerk_id = _create_clerk_user(email, temp_password, first_name, last_name)

        # Create the Django User record
        invite_token = str(uuid.uuid4())
        invited_user = User.objects.create_user(
            email=email,
            tenant=tenant,
            role=role,
            first_name=first_name,
            last_name=last_name,
            is_active=True,          # Active immediately — credentials are in the email
            invite_token=invite_token,
            clerk_id=clerk_id,        # Linked right away if Clerk creation succeeded
        )

        # Build the login URL with email pre-filled
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        login_url = f'{frontend_url}/auth/login?email={email}&invited=1'

        admin_name = request.user.get_full_name() or request.user.email
        role_display = {'HR': 'HR Manager', 'FINANCE': 'Finance Manager', 'EMPLOYEE': 'Employee'}.get(role, role)
        company_from_email = f"WorkWise <onboarding@resend.dev>"

        from core.email_templates import invite_email_html
        subject, html_body = invite_email_html(
            first_name=first_name or 'there',
            admin_name=admin_name,
            company_name=tenant.name,
            role_display=role_display,
            email=email,
            temp_password=temp_password,
            login_url=login_url,
        )

        from django.core.mail import EmailMultiAlternatives
        msg = EmailMultiAlternatives(
            subject=subject,
            body=(
                f"Hi {first_name or 'there'},\n\n"
                f"{admin_name} has added you to {tenant.name} on WorkWise as {role_display}.\n\n"
                f"Email:    {email}\nPassword: {temp_password}\n\nSign in: {login_url}\n\n"
                f"Change your password after first login: Settings → Security → Change Password"
            ),
            from_email=f"WorkWise <onboarding@resend.dev>",
            to=[email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)

        logger.info(
            "Invited user %s as %s to tenant %s (clerk_id=%s)",
            email, role, tenant.name, clerk_id[:8] + '...' if clerk_id else 'None'
        )

        return Response(
            {
                "id": str(invited_user.id),
                "email": invited_user.email,
                "role": invited_user.role,
                "clerk_linked": clerk_id is not None,
                "message": f"Invitation sent to {email} with login credentials.",
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
                {"error": "This invite has already been accepted. Use Remove Member to delete an active user."},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        invited_user.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class RemoveTeamMemberView(APIView):
    """
    DELETE /api/users/team/<uuid:pk>/remove/

    Admin removes an active team member.
    - Deletes the user from Django DB
    - Also deletes from Clerk via Backend API so they can no longer log in
    - Cannot remove yourself (the requesting admin)
    - Cannot remove other ADMIN accounts
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def delete(self, request, pk):
        try:
            member = User.objects.get(id=pk, tenant=request.user.tenant)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=http_status.HTTP_404_NOT_FOUND)

        # Cannot remove yourself
        if member.id == request.user.id:
            return Response(
                {"error": "You cannot remove your own account."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Cannot remove other admins (prevents accidental lockout)
        if member.role == 'ADMIN':
            return Response(
                {"error": "Admin accounts cannot be removed from here. Contact support."},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        email = member.email
        clerk_id = member.clerk_id

        # Delete from Django first
        member.delete()
        logger.info("Team member %s removed from tenant %s by %s", email, request.user.tenant.name, request.user.email)

        # Delete from Clerk so they can no longer log in
        if clerk_id:
            secret_key = getattr(settings, 'CLERK_SECRET_KEY', '')
            if secret_key:
                try:
                    resp = _http.delete(
                        f'https://api.clerk.com/v1/users/{clerk_id}',
                        headers={'Authorization': f'Bearer {secret_key}'},
                        timeout=10,
                    )
                    if resp.status_code in (200, 204):
                        logger.info("Clerk user %s deleted for removed member %s", clerk_id[:12], email)
                    else:
                        logger.warning(
                            "Clerk deletion failed for %s (status %s) — user removed from DB only",
                            email, resp.status_code
                        )
                except Exception as exc:
                    logger.error("Clerk API error during member removal for %s: %s", email, exc)

        return Response(
            {"message": f"{email} has been removed from your workspace."},
            status=http_status.HTTP_200_OK,
        )


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

