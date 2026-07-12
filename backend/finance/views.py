"""
finance/views.py
----------------
API views for the Finance module.

Expense Claims      — /api/finance/expenses/
Department Budgets  — /api/finance/budgets/
Petty Cash Funds    — /api/finance/petty-cash/
Petty Cash Txns     — /api/finance/petty-cash/<id>/transactions/
Financial Summary   — /api/finance/summary/
"""

import logging
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ExpenseClaim, DepartmentBudget, PettyCashFund, PettyCashTransaction
from .serializers import (
    ExpenseClaimSerializer, DepartmentBudgetSerializer,
    PettyCashFundSerializer, PettyCashTransactionSerializer,
)
from core.permissions import IsFinanceOrAdmin, IsHROrFinanceOrAdmin

logger = logging.getLogger(__name__)


# ── Expense Claims ────────────────────────────────────────────────────────────

class ExpenseClaimViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseClaimSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = self.request.user.tenant
        role = self.request.user.role
        qs = ExpenseClaim.objects.filter(employee__tenant=tenant).select_related(
            'employee', 'submitted_by', 'reviewed_by'
        )
        # Finance / Admin / HR see all claims; employees see only their own
        if role not in ('ADMIN', 'FINANCE', 'HR'):
            from employees.models import Employee
            try:
                emp = Employee.objects.get(tenant=tenant, email=self.request.user.email)
                qs = qs.filter(employee=emp)
            except Employee.DoesNotExist:
                return ExpenseClaim.objects.none()

        # Filters
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(employee__department=dept)
        return qs

    def perform_create(self, serializer):
        tenant = self.request.user.tenant
        # Validate the employee belongs to this tenant
        employee = serializer.validated_data.get('employee')
        if employee.tenant != tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'employee': 'Invalid employee for this tenant.'})
        # ExpenseClaim uses TenantScopedModel — no direct tenant FK, scoped via employee__tenant
        serializer.save(submitted_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        claim = self.get_object()
        if request.user.role not in ('ADMIN', 'FINANCE'):
            return Response({'error': 'Only Finance Manager or Admin can approve claims.'},
                            status=status.HTTP_403_FORBIDDEN)
        if claim.status != 'pending':
            return Response({'error': 'Only pending claims can be approved.'},
                            status=status.HTTP_400_BAD_REQUEST)
        claim.status = 'approved'
        claim.reviewed_by = request.user
        claim.review_comment = request.data.get('comment', '')
        claim.reviewed_at = timezone.now()
        claim.save(update_fields=['status', 'reviewed_by', 'review_comment', 'reviewed_at', 'updated_at'])
        logger.info("Expense claim %s approved by %s", claim.id, request.user.email)
        return Response(ExpenseClaimSerializer(claim).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        claim = self.get_object()
        if request.user.role not in ('ADMIN', 'FINANCE'):
            return Response({'error': 'Only Finance Manager or Admin can reject claims.'},
                            status=status.HTTP_403_FORBIDDEN)
        if claim.status in ('rejected', 'paid'):
            return Response({'error': 'This claim is already finalised.'},
                            status=status.HTTP_400_BAD_REQUEST)
        claim.status = 'rejected'
        claim.reviewed_by = request.user
        claim.review_comment = request.data.get('comment', '')
        claim.reviewed_at = timezone.now()
        claim.save(update_fields=['status', 'reviewed_by', 'review_comment', 'reviewed_at', 'updated_at'])
        return Response(ExpenseClaimSerializer(claim).data)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        claim = self.get_object()
        if request.user.role not in ('ADMIN', 'FINANCE'):
            return Response({'error': 'Only Finance Manager or Admin can mark claims as paid.'},
                            status=status.HTTP_403_FORBIDDEN)
        if claim.status != 'approved':
            return Response({'error': 'Only approved claims can be marked as paid.'},
                            status=status.HTTP_400_BAD_REQUEST)
        claim.status = 'paid'
        claim.paid_at = timezone.now()
        claim.save(update_fields=['status', 'paid_at', 'updated_at'])
        return Response(ExpenseClaimSerializer(claim).data)


# ── Department Budgets ────────────────────────────────────────────────────────

class DepartmentBudgetViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentBudgetSerializer
    permission_classes = [permissions.IsAuthenticated, IsHROrFinanceOrAdmin]

    def get_queryset(self):
        # DepartmentBudget uses TenantScopedModel — auto-scoped via context, no direct tenant FK
        qs = DepartmentBudget.objects.all()
        year  = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        dept  = self.request.query_params.get('department')
        if year:  qs = qs.filter(period_year=int(year))
        if month: qs = qs.filter(period_month=int(month))
        if dept:  qs = qs.filter(department=dept)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ('ADMIN', 'FINANCE'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only Finance Manager or Admin can create budgets.')
        # DepartmentBudget has no direct tenant FK — auto-scoped by TenantManager context
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.role not in ('ADMIN', 'FINANCE'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only Finance Manager or Admin can update budgets.')
        serializer.save()

    @action(detail=False, methods=['get'], url_path='utilization')
    def utilization(self, request):
        """
        Returns budget vs actual spend for each department for a given month/year.
        Actual spend = payroll cost + approved expenses for that department.
        """
        from employees.models import Employee
        from payroll.models import PayrollItem, PayrollRun

        tenant = request.user.tenant
        today  = timezone.now().date()
        year   = int(request.query_params.get('year',  today.year))
        month  = int(request.query_params.get('month', today.month))

        budgets = DepartmentBudget.objects.filter(
            period_year=year, period_month=month
        )

        result = []
        for budget in budgets:
            dept = budget.department

            # Payroll cost for this department this month
            dept_employees = Employee.unscoped.filter(tenant=tenant, department=dept)
            payroll_run = PayrollRun.objects.filter(tenant=tenant, year=year, month=month).first()
            payroll_cost = Decimal('0')
            if payroll_run:
                payroll_cost = PayrollItem.objects.filter(
                    payroll_run=payroll_run,
                    employee__in=dept_employees
                ).aggregate(t=Sum('gross_salary'))['t'] or Decimal('0')

            # Approved expenses for this department this month
            expense_cost = ExpenseClaim.objects.filter(
                employee__tenant=tenant,
                employee__department=dept,
                status__in=('approved', 'paid'),
                expense_date__year=year,
                expense_date__month=month,
            ).aggregate(t=Sum('amount'))['t'] or Decimal('0')

            actual = payroll_cost + expense_cost
            utilization_pct = round((actual / budget.budget_amount) * 100, 1) if budget.budget_amount else 0

            result.append({
                'department':      dept,
                'budget':          float(budget.budget_amount),
                'payroll_cost':    float(payroll_cost),
                'expense_cost':    float(expense_cost),
                'actual_spend':    float(actual),
                'remaining':       float(budget.budget_amount - actual),
                'utilization_pct': utilization_pct,
                'over_budget':     actual > budget.budget_amount,
            })

        return Response({'month': month, 'year': year, 'departments': result})


# ── Petty Cash ────────────────────────────────────────────────────────────────

class PettyCashFundViewSet(viewsets.ModelViewSet):
    serializer_class = PettyCashFundSerializer
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]

    def get_queryset(self):
        # PettyCashFund uses TenantScopedModel — auto-scoped by context
        return PettyCashFund.objects.all()

    def perform_create(self, serializer):
        fund = serializer.save()
        fund.current_balance = fund.opening_balance
        fund.save(update_fields=['current_balance'])

    @action(detail=True, methods=['get', 'post'], url_path='transactions')
    def transactions(self, request, pk=None):
        fund = self.get_object()

        if request.method == 'GET':
            txns = PettyCashTransaction.objects.filter(fund=fund)
            s = request.query_params.get('status')
            if s:
                txns = txns.filter(status=s)
            return Response(PettyCashTransactionSerializer(txns, many=True).data)

        # POST — create a new transaction request
        serializer = PettyCashTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        txn = serializer.save(
            fund=fund,
            requested_by=request.user,
            status='pending',
        )
        return Response(PettyCashTransactionSerializer(txn).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='transactions/(?P<txn_id>[^/.]+)/approve')
    def approve_transaction(self, request, pk=None, txn_id=None):
        fund = self.get_object()
        try:
            txn = PettyCashTransaction.objects.get(id=txn_id, fund=fund)
        except PettyCashTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        if txn.status != 'pending':
            return Response({'error': 'Only pending transactions can be approved.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if txn.transaction_type == 'request' and fund.current_balance < txn.amount:
            return Response({'error': f'Insufficient fund balance. Available: KES {fund.current_balance:,.2f}'},
                            status=status.HTTP_400_BAD_REQUEST)

        txn.status = 'approved'
        txn.approved_by = request.user
        txn.approval_comment = request.data.get('comment', '')
        txn.approved_at = timezone.now()
        txn.disbursed_at = timezone.now()
        txn.status = 'disbursed'
        txn.save()

        # Update fund balance
        if txn.transaction_type == 'request':
            fund.current_balance -= txn.amount
        else:  # topup or replenishment
            fund.current_balance += txn.amount
        fund.save(update_fields=['current_balance', 'updated_at'])

        return Response(PettyCashTransactionSerializer(txn).data)

    @action(detail=True, methods=['post'], url_path='transactions/(?P<txn_id>[^/.]+)/reject')
    def reject_transaction(self, request, pk=None, txn_id=None):
        fund = self.get_object()
        try:
            txn = PettyCashTransaction.objects.get(id=txn_id, fund=fund)
        except PettyCashTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        if txn.status not in ('pending',):
            return Response({'error': 'Only pending transactions can be rejected.'},
                            status=status.HTTP_400_BAD_REQUEST)
        txn.status = 'rejected'
        txn.approved_by = request.user
        txn.approval_comment = request.data.get('comment', '')
        txn.approved_at = timezone.now()
        txn.save()
        return Response(PettyCashTransactionSerializer(txn).data)


# ── Financial Summary (Finance Dashboard) ────────────────────────────────────

class FinancialSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHROrFinanceOrAdmin]

    def get(self, request):
        from payroll.models import PayrollRun, PayrollItem
        from django.utils import timezone

        tenant = request.user.tenant
        today  = timezone.now().date()
        year   = int(request.query_params.get('year',  today.year))
        month  = int(request.query_params.get('month', today.month))

        # ── Payroll cost this month ───────────────────────────────────────────
        payroll_run = PayrollRun.objects.filter(tenant=tenant, year=year, month=month).first()
        payroll_cost = Decimal('0')
        if payroll_run:
            payroll_cost = PayrollItem.objects.filter(
                payroll_run=payroll_run
            ).aggregate(t=Sum('gross_salary'))['t'] or Decimal('0')

        # ── Expense claims this month ─────────────────────────────────────────
        # ExpenseClaim uses TenantScopedModel — tenant is accessed via employee__tenant
        expenses_qs = ExpenseClaim.objects.filter(
            employee__tenant=tenant,
            expense_date__year=year,
            expense_date__month=month,
        )
        total_expenses    = expenses_qs.filter(status__in=('approved','paid')).aggregate(t=Sum('amount'))['t'] or Decimal('0')
        pending_expenses  = expenses_qs.filter(status='pending').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        pending_count     = expenses_qs.filter(status='pending').count()

        # ── Petty cash balance ────────────────────────────────────────────────
        # PettyCashFund uses TenantScopedModel — access via employee__tenant path
        # The fund is directly tenant-scoped, use the objects manager which auto-scopes
        from finance.models import PettyCashFund as PCF
        petty_balance = PCF.objects.filter(is_active=True).aggregate(
            t=Sum('current_balance')
        )['t'] or Decimal('0')

        # ── Budget utilization ────────────────────────────────────────────────
        # DepartmentBudget uses TenantScopedModel — auto-scoped by context manager,
        # do NOT filter by tenant= directly (no direct tenant FK on the model)
        budgets = DepartmentBudget.objects.filter(
            period_year=year, period_month=month
        )
        total_budget = budgets.aggregate(t=Sum('budget_amount'))['t'] or Decimal('0')
        total_actual = payroll_cost + total_expenses
        budget_pct   = round((total_actual / total_budget) * 100, 1) if total_budget else 0

        # ── Expense by category ───────────────────────────────────────────────
        by_category = list(
            expenses_qs.filter(status__in=('approved','paid'))
            .values('category')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )

        return Response({
            'month':             month,
            'year':              year,
            'payroll_cost':      float(payroll_cost),
            'total_expenses':    float(total_expenses),
            'pending_expenses':  float(pending_expenses),
            'pending_count':     pending_count,
            'petty_balance':     float(petty_balance),
            'total_budget':      float(total_budget),
            'total_actual':      float(total_actual),
            'budget_utilization_pct': budget_pct,
            'expenses_by_category': [
                {'category': c['category'], 'total': float(c['total'])}
                for c in by_category
            ],
        })
