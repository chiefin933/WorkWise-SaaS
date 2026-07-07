"""
core/rbac.py
-------------
Granular Role-Based Access Control (RBAC) for WorkWise.

Design principles:
  1. Permissions are strings like "payroll.approve" — easy to check, audit, extend
  2. Roles are predefined but companies can customise which permissions each role gets
  3. The User model still carries a simple role name for fast lookups and UI rendering
  4. Fine-grained checks use has_permission(user, "payroll.approve")
  5. Backward-compatible — existing role checks continue to work

Permission catalogue:
  employee.*   — employee record CRUD + lifecycle
  attendance.* — clock-in, edit logs
  leave.*      — approve/reject/manage leave
  payroll.*    — run, approve, lock, disburse, reverse, export
  finance.*    — expenses, budgets, petty cash, books
  reports.*    — export statutory and custom reports
  settings.*   — company settings, payroll config, team management
  audit.*      — read audit trail
"""

from __future__ import annotations
from typing import Set


# ── Permission catalogue ──────────────────────────────────────────────────────

PERMISSIONS = {
    # Employee management
    'employee.view':        'View employee profiles',
    'employee.create':      'Add new employees',
    'employee.edit':        'Edit employee profiles',
    'employee.delete':      'Delete employees',
    'employee.export':      'Export employee data',
    'employee.import':      'Bulk import employees via CSV',

    # Attendance
    'attendance.view':      'View attendance logs',
    'attendance.edit':      'Edit attendance records manually',
    'attendance.clockin':   'Clock in / clock out (own record)',

    # Leave
    'leave.view_own':       'View own leave requests',
    'leave.view_all':       'View all leave requests',
    'leave.request':        'Submit a leave request',
    'leave.manager_approve':'First-stage (manager) leave approval',
    'leave.approve':        'Final leave approval',
    'leave.policy':         'Edit leave policy',

    # Payroll
    'payroll.view':         'View payroll runs and items',
    'payroll.create':       'Create a new payroll run',
    'payroll.process':      'Process (calculate) a payroll run',
    'payroll.approve':      'Approve a processed payroll run',
    'payroll.lock':         'Lock an approved/paid payroll run',
    'payroll.reverse':      'Reverse an approved or paid run',
    'payroll.disburse':     'Disburse salaries via M-Pesa',
    'payroll.export':       'Export payroll and statutory files',
    'payroll.send_payslips':'Email payslips to employees',
    'payroll.config':       'Edit payroll statutory configuration',

    # Finance
    'finance.expenses.view':    'View expense claims',
    'finance.expenses.submit':  'Submit expense claims',
    'finance.expenses.approve': 'Approve/reject expense claims',
    'finance.budgets':          'Manage department budgets',
    'finance.petty_cash':       'Manage petty cash funds',
    'finance.books':            'Access chart of accounts and journal',
    'finance.reports':          'View financial statements',

    # Reports
    'reports.payroll':      'Export payroll/statutory reports',
    'reports.hr':           'Export HR reports (attendance, leave, employees)',
    'reports.finance':      'Export financial reports',

    # Settings
    'settings.company':     'Edit company profile',
    'settings.team':        'Invite and remove team members',
    'settings.billing':     'Manage subscription and billing',
    'settings.roles':       'Manage role permissions',

    # Audit
    'audit.view':           'View audit trail',
}


# ── Default permissions per role ──────────────────────────────────────────────
# Each role gets a base set of permissions.
# Companies can add/remove permissions per role in their settings.
# The ADMIN role always has everything and cannot be restricted.

DEFAULT_ROLE_PERMISSIONS: dict[str, Set[str]] = {
    'ADMIN': set(PERMISSIONS.keys()),   # Full access — immutable

    'HR': {
        'employee.view', 'employee.create', 'employee.edit',
        'employee.export', 'employee.import',
        'attendance.view', 'attendance.edit', 'attendance.clockin',
        'leave.view_own', 'leave.view_all', 'leave.request',
        'leave.manager_approve', 'leave.approve', 'leave.policy',
        'payroll.view', 'payroll.create', 'payroll.process',
        'payroll.export', 'payroll.send_payslips',
        'finance.expenses.view',
        'reports.payroll', 'reports.hr',
        'settings.company',
    },

    'FINANCE': {
        'employee.view',
        'attendance.view',
        'leave.view_all',
        'payroll.view', 'payroll.approve', 'payroll.lock',
        'payroll.reverse', 'payroll.disburse', 'payroll.export',
        'finance.expenses.view', 'finance.expenses.approve',
        'finance.budgets', 'finance.petty_cash',
        'finance.books', 'finance.reports',
        'reports.payroll', 'reports.finance',
        'settings.company',
    },

    'EMPLOYEE': {
        'attendance.clockin',
        'leave.view_own', 'leave.request',
        'finance.expenses.submit',
    },
}


# ── Runtime permission check ───────────────────────────────────────────────────

def get_role_permissions(role: str, custom_permissions: dict | None = None) -> Set[str]:
    """
    Return the full permission set for a role.

    custom_permissions is a dict stored on the tenant's RolePermission object:
      {'HR': {'added': ['payroll.approve'], 'removed': ['employee.delete']}}

    ADMIN always gets full permissions regardless of customisation.
    """
    if role == 'ADMIN':
        return set(PERMISSIONS.keys())

    base = DEFAULT_ROLE_PERMISSIONS.get(role, set()).copy()

    if custom_permissions and role in custom_permissions:
        overrides = custom_permissions[role]
        base |= set(overrides.get('added',   []))
        base -= set(overrides.get('removed', []))

    return base


def has_permission(user, permission: str) -> bool:
    """
    Check if a user has a specific permission.

    Usage:
        from core.rbac import has_permission
        if has_permission(request.user, 'payroll.approve'):
            ...
    """
    if not user or not user.is_authenticated:
        return False

    # ADMIN always has everything
    if user.role == 'ADMIN':
        return True

    # Load tenant-level custom overrides
    custom = None
    try:
        if user.tenant:
            rp = user.tenant.role_permissions  # RolePermission OneToOne
            custom = rp.permissions
    except Exception:
        pass

    return permission in get_role_permissions(user.role, custom)


# ── DRF permission class factory ──────────────────────────────────────────────

from rest_framework import permissions as drf_permissions


class HasPermission(drf_permissions.BasePermission):
    """
    DRF permission class that checks a specific WorkWise permission.

    Usage:
        class MyView(APIView):
            permission_classes = [IsAuthenticated, HasPermission('payroll.approve')]
    """
    def __init__(self, permission: str):
        self.permission = permission

    def has_permission(self, request, view):
        return has_permission(request.user, self.permission)


def require_permission(permission: str):
    """
    Factory that returns a DRF permission class for a given permission string.
    Allows clean inline usage:

        permission_classes = [IsAuthenticated, require_permission('payroll.approve')]
    """
    class _P(drf_permissions.BasePermission):
        _perm = permission
        def has_permission(self, request, view):
            return has_permission(request.user, self._perm)
    _P.__name__ = f'Requires_{permission.replace(".", "_")}'
    return _P
