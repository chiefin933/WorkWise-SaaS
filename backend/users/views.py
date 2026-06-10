from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as http_status
from rest_framework.throttling import ScopedRateThrottle
from .serializers import CustomTokenObtainPairSerializer, UserRegistrationSerializer, UserSerializer
from .models import User
import logging

logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint — rate-limited to 10 attempts per minute per IP to
    prevent brute-force attacks against user passwords.
    """
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


class RegisterView(generics.CreateAPIView):
    """
    Registration endpoint — rate-limited to 5 sign-ups per hour per IP to
    prevent mass account creation / abuse.
    """
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserRegistrationSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
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
