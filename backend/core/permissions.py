from rest_framework import permissions

class IsHROrAdmin(permissions.BasePermission):
    """
    Allows access only to users with ADMIN or HR roles.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ('ADMIN', 'HR')
        )
