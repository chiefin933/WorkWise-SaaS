from rest_framework import permissions


class IsHROrAdmin(permissions.BasePermission):
    """HR Manager or Admin — manages employees, payroll, leave."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('ADMIN', 'HR')
        )


class IsFinanceOrAdmin(permissions.BasePermission):
    """Finance Manager or Admin — manages expenses, budgets, petty cash."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('ADMIN', 'FINANCE')
        )


class IsHROrFinanceOrAdmin(permissions.BasePermission):
    """Any management role — can read financial and HR data."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('ADMIN', 'HR', 'FINANCE')
        )


class IsAdmin(permissions.BasePermission):
    """Admin only — settings, billing, audit, team management."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'ADMIN'
        )


class IsEmployee(permissions.BasePermission):
    """Employee self-service only."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'EMPLOYEE'
        )


class IsSelfOrHRAdmin(permissions.BasePermission):
    """Object-level: resource owner OR HR/Admin."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.role in ('ADMIN', 'HR'):
            return True
        obj_email = getattr(obj, 'email', None)
        if obj_email and obj_email == getattr(request.user, 'email', None):
            return True
        obj_user = getattr(obj, 'user', None)
        if obj_user and obj_user == request.user:
            return True
        return False
