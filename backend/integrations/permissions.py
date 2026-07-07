from rest_framework.permissions import BasePermission
from .models import APIKey


class IsValidAPIKey(BasePermission):
    def has_permission(self, request, view):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return False
        key = auth_header.split(" ")[1]
        try:
            api_key = APIKey.objects.get(key=key, is_active=True)
            if api_key.is_expired:
                return False
            request.api_key = api_key
            return True
        except APIKey.DoesNotExist:
            return False
