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


class IsAdmin(permissions.BasePermission):
    """
    Allows access only to users with the ADMIN role.
    Use for tenant/billing settings and any superuser-only operations.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'ADMIN'
        )


class IsEmployee(permissions.BasePermission):
    """
    Allows access only to users with the EMPLOYEE role.
    Use for self-service endpoints that employees (not HR/Admin) consume.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'EMPLOYEE'
        )


class IsSelfOrHRAdmin(permissions.BasePermission):
    """
    Object-level permission: passes if the requesting user is the resource
    owner (matched by email) OR has the HR/ADMIN role.

    Safe methods (GET, HEAD, OPTIONS) are always allowed for the object owner
    and for HR/Admin. Mutating methods additionally require ownership or
    HR/Admin status.

    Usage in a ViewSet:
        def get_permissions(self):
            if self.action in ['retrieve', 'update', 'partial_update']:
                return [IsAuthenticated(), IsSelfOrHRAdmin()]
            ...
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        # HR and Admin can do anything
        if request.user.role in ('ADMIN', 'HR'):
            return True

        # For objects that have an email attribute (Employee, User)
        obj_email = getattr(obj, 'email', None)
        if obj_email and obj_email == getattr(request.user, 'email', None):
            return True

        # For objects that have a user FK pointing at the requesting user
        obj_user = getattr(obj, 'user', None)
        if obj_user and obj_user == request.user:
            return True

        return False
