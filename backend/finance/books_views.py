"""
finance/books_views.py
----------------------
REST API for the Finance Books module:

  /api/finance/accounts/            Chart of Accounts CRUD
  /api/finance/accounts/seed/       Re-seed standard COA
  /api/finance/journal/             Journal Entries list/create
  /api/finance/journal/<id>/        Retrieve/update
  /api/finance/journal/<id>/post/   Post a draft entry
  /api/finance/journal/<id>/reverse/ Reverse a posted entry
  /api/finance/ledger/              General Ledger (account transactions)
  /api/finance/trial-balance/       Trial Balance
  /api/finance/income-statement/    Income Statement (P&L)
  /api/finance/balance-sheet/       Balance Sheet
"""

import logging
from decimal import Decimal
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from .books_models import ChartOfAccount, JournalEntry, JournalLine
from .books_serializers import (
    ChartOfAccountSerializer, JournalEntrySerializer,
    JournalEntryWriteSerializer, JournalLineSerializer,
)
from core.permissions import IsFinanceOrAdmin, IsHROrFinanceOrAdmin

logger = logging.getLogger(__name__)


# ── Chart of Accounts ─────────────────────────────────────────────────────────

class ChartOfAccountViewSet(viewsets.ModelViewSet):
    serializer_class   = ChartOfAccountSerializer
    permission_classes = [permissions.IsAuthenticated, IsHROrFinanceOrAdmin]

    def get_queryset(self):
        # ChartOfAccount uses TenantScopedModel — auto-scoped by context
        qs = ChartOfAccount.objects.all()
        account_type = self.request.query_params.get('type')
        active_only  = self.request.query_params.get('active', 'true').lower() == 'true'
        if account_type:
            qs = qs.filter(account_type=account_type.upper())
        if active_only:
            qs = qs.filter(is_active=True)
        return qs.select_related('parent')

    def perform_create(self, serializer):
        if self.request.user.role not in ('ADMIN', 'FINANCE'):
            raise ValidationError('Only Finance Manager or Admin can add accounts.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        account = self.get_object()
        if account.is_system:
            return Response(
                {'error': 'System accounts cannot be deleted. Deactivate instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if account.journal_lines.filter(entry__status='POSTED').exists():
            return Response(
                {'error': 'Cannot delete an account with posted transactions.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def seed(self, request):
        """Re-seed the standard Kenyan COA for this tenant (idempotent)."""
        if request.user.role not in ('ADMIN', 'FINANCE'):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from finance.seed_coa import seed_chart_of_accounts
        seed_chart_of_accounts(request.user.tenant)
        count = ChartOfAccount.objects.all().count()
        return Response({'message': f'Chart of accounts seeded. {count} accounts available.'})

    @action(detail=True, methods=['get'], url_path='ledger')
    def account_ledger(self, request, pk=None):
        """Return all posted transactions for a specific account (mini ledger)."""
        account = self.get_object()
        lines   = JournalLine.objects.filter(
            account=account,
            entry__status='POSTED',
        ).select_related('entry').order_by('entry__date', 'entry__created_at')

        running = Decimal('0')
        result  = []
        for line in lines:
            if account.account_type in ('ASSET', 'EXPENSE'):
                running += line.amount if line.side == 'DEBIT' else -line.amount
            else:
                running += line.amount if line.side == 'CREDIT' else -line.amount

            result.append({
                'date':        line.entry.date.isoformat(),
                'reference':   line.entry.reference,
                'description': line.description or line.entry.description,
                'debit':       float(line.amount) if line.side == 'DEBIT'  else 0,
                'credit':      float(line.amount) if line.side == 'CREDIT' else 0,
                'balance':     float(running),
                'entry_id':    str(line.entry.id),
            })

        return Response({
            'account_code':    account.code,
            'account_name':    account.name,
            'account_type':    account.account_type,
            'normal_balance':  account.normal_balance,
            'closing_balance': float(running),
            'transactions':    result,
        })


# ── Journal Entries ───────────────────────────────────────────────────────────

class JournalEntryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return JournalEntryWriteSerializer
        return JournalEntrySerializer

    def get_queryset(self):
        # JournalEntry uses TenantScopedModel — auto-scoped by context, no direct tenant FK
        qs     = JournalEntry.objects.all()
        src    = self.request.query_params.get('source')
        st     = self.request.query_params.get('status')
        date_f = self.request.query_params.get('date_from')
        date_t = self.request.query_params.get('date_to')
        if src:    qs = qs.filter(source=src.upper())
        if st:     qs = qs.filter(status=st.upper())
        if date_f: qs = qs.filter(date__gte=date_f)
        if date_t: qs = qs.filter(date__lte=date_t)
        return qs.prefetch_related('lines__account').select_related('created_by')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def post_entry(self, request, pk=None):
        entry = self.get_object()
        try:
            entry.post()
            logger.info("Journal entry %s posted by %s", entry.id, request.user.email)
            return Response(JournalEntrySerializer(entry).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        entry = self.get_object()
        try:
            reversal = entry.reverse(
                created_by=request.user,
                description=request.data.get('description', ''),
            )
            logger.info("Journal entry %s reversed by %s", entry.id, request.user.email)
            return Response(JournalEntrySerializer(reversal).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ── Trial Balance ─────────────────────────────────────────────────────────────

class TrialBalanceView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHROrFinanceOrAdmin]

    def get(self, request):
        tenant  = request.user.tenant
        date_to = request.query_params.get('date_to', timezone.now().date().isoformat())

        accounts = ChartOfAccount.objects.filter(
            tenant=tenant, is_active=True
        ).order_by('code')

        rows         = []
        total_debit  = Decimal('0')
        total_credit = Decimal('0')

        for acct in accounts:
            lines = JournalLine.objects.filter(
                account=acct,
                entry__status='POSTED',
                entry__date__lte=date_to,
            )
            debits  = lines.filter(side='DEBIT').aggregate(t=Sum('amount'))['t']  or Decimal('0')
            credits = lines.filter(side='CREDIT').aggregate(t=Sum('amount'))['t'] or Decimal('0')

            if debits == 0 and credits == 0:
                continue  # Skip accounts with no activity

            balance = debits - credits
            row = {
                'code':         acct.code,
                'name':         acct.name,
                'account_type': acct.account_type,
                'debit':        float(debits),
                'credit':       float(credits),
            }
            # Show net in the normal-balance column
            if balance >= 0:
                row['net_debit']  = float(balance)
                row['net_credit'] = 0
                total_debit += balance
            else:
                row['net_debit']  = 0
                row['net_credit'] = float(-balance)
                total_credit += -balance

            rows.append(row)

        return Response({
            'date_to':      date_to,
            'accounts':     rows,
            'total_debit':  float(total_debit),
            'total_credit': float(total_credit),
            'balanced':     total_debit == total_credit,
        })


# ── Income Statement (Profit & Loss) ─────────────────────────────────────────

class IncomeStatementView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHROrFinanceOrAdmin]

    def get(self, request):
        tenant   = request.user.tenant
        today    = timezone.now().date()
        date_from = request.query_params.get('date_from', today.replace(day=1).isoformat())
        date_to   = request.query_params.get('date_to',   today.isoformat())

        def _account_net(account_type: str, sub_code_prefix: str = '') -> list:
            qs = ChartOfAccount.objects.filter(
                tenant=tenant,
                account_type=account_type,
                is_active=True,
            )
            if sub_code_prefix:
                qs = qs.filter(code__startswith=sub_code_prefix)
            else:
                qs = qs.exclude(parent__isnull=True)  # Exclude header accounts

            items = []
            for acct in qs.order_by('code'):
                lines = JournalLine.objects.filter(
                    account=acct,
                    entry__status='POSTED',
                    entry__date__gte=date_from,
                    entry__date__lte=date_to,
                )
                debits  = lines.filter(side='DEBIT').aggregate(t=Sum('amount'))['t']  or Decimal('0')
                credits = lines.filter(side='CREDIT').aggregate(t=Sum('amount'))['t'] or Decimal('0')
                # For Revenue: net = credits - debits (credit normal)
                # For Expense: net = debits - credits (debit normal)
                if account_type == 'REVENUE':
                    net = credits - debits
                else:
                    net = debits - credits
                if net != 0:
                    items.append({'code': acct.code, 'name': acct.name, 'amount': float(net)})
            return items

        revenue_items  = _account_net('REVENUE')
        expense_items  = _account_net('EXPENSE')

        total_revenue  = sum(i['amount'] for i in revenue_items)
        total_expenses = sum(i['amount'] for i in expense_items)
        # Split expenses for gross profit calculation
        cogs_items     = [i for i in expense_items if i['code'].startswith('51')]
        opex_items     = [i for i in expense_items if not i['code'].startswith('51')]
        total_cogs     = sum(i['amount'] for i in cogs_items)
        gross_profit   = total_revenue - total_cogs
        net_profit     = total_revenue - total_expenses

        return Response({
            'date_from':     date_from,
            'date_to':       date_to,
            'revenue':       revenue_items,
            'total_revenue': total_revenue,
            'cogs':          cogs_items,
            'total_cogs':    total_cogs,
            'gross_profit':  gross_profit,
            'expenses':      opex_items,
            'total_expenses': total_expenses,
            'net_profit':    net_profit,
        })


# ── Balance Sheet ─────────────────────────────────────────────────────────────

class BalanceSheetView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHROrFinanceOrAdmin]

    def get(self, request):
        tenant  = request.user.tenant
        date_to = request.query_params.get('date_to', timezone.now().date().isoformat())

        def _section(account_type: str) -> tuple[list, Decimal]:
            qs = ChartOfAccount.objects.filter(
                tenant=tenant,
                account_type=account_type,
                is_active=True,
            ).exclude(parent__isnull=True).order_by('code')

            items = []
            total = Decimal('0')
            for acct in qs:
                lines = JournalLine.objects.filter(
                    account=acct,
                    entry__status='POSTED',
                    entry__date__lte=date_to,
                )
                debits  = lines.filter(side='DEBIT').aggregate(t=Sum('amount'))['t']  or Decimal('0')
                credits = lines.filter(side='CREDIT').aggregate(t=Sum('amount'))['t'] or Decimal('0')
                if account_type == 'ASSET':
                    balance = debits - credits
                else:
                    balance = credits - debits
                if balance != 0:
                    items.append({'code': acct.code, 'name': acct.name, 'balance': float(balance)})
                    total += balance
            return items, total

        asset_items,     total_assets      = _section('ASSET')
        liability_items, total_liabilities = _section('LIABILITY')
        equity_items,    total_equity      = _section('EQUITY')

        # Include net profit from income statement in equity
        from django.db.models import Sum as DSum
        revenue_total = JournalLine.objects.filter(
            account__tenant=tenant,
            account__account_type='REVENUE',
            entry__status='POSTED',
            entry__date__lte=date_to,
        ).aggregate(
            debits=DSum('amount', filter=Q(side='DEBIT')),
            credits=DSum('amount', filter=Q(side='CREDIT')),
        )
        expense_total = JournalLine.objects.filter(
            account__tenant=tenant,
            account__account_type='EXPENSE',
            entry__status='POSTED',
            entry__date__lte=date_to,
        ).aggregate(
            debits=DSum('amount', filter=Q(side='DEBIT')),
            credits=DSum('amount', filter=Q(side='CREDIT')),
        )
        net_rev  = (revenue_total['credits'] or Decimal('0')) - (revenue_total['debits'] or Decimal('0'))
        net_exp  = (expense_total['debits']  or Decimal('0')) - (expense_total['credits'] or Decimal('0'))
        net_income = net_rev - net_exp
        total_equity += net_income

        return Response({
            'date_to':           date_to,
            'assets':            asset_items,
            'total_assets':      float(total_assets),
            'liabilities':       liability_items,
            'total_liabilities': float(total_liabilities),
            'equity':            equity_items,
            'net_income':        float(net_income),
            'total_equity':      float(total_equity),
            'balanced':          abs(total_assets - (total_liabilities + total_equity)) < Decimal('0.01'),
        })


# ── General Ledger ────────────────────────────────────────────────────────────

class GeneralLedgerView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHROrFinanceOrAdmin]

    def get(self, request):
        tenant    = request.user.tenant
        today     = timezone.now().date()
        date_from = request.query_params.get('date_from', today.replace(day=1).isoformat())
        date_to   = request.query_params.get('date_to',   today.isoformat())
        acct_code = request.query_params.get('account')

        accounts = ChartOfAccount.objects.filter(is_active=True).order_by('code')
        if acct_code:
            accounts = accounts.filter(code=acct_code)

        ledger = []
        for acct in accounts:
            lines = JournalLine.objects.filter(
                account=acct,
                entry__status='POSTED',
                entry__date__gte=date_from,
                entry__date__lte=date_to,
            ).select_related('entry').order_by('entry__date', 'entry__created_at')

            if not lines.exists():
                continue

            running = Decimal('0')
            txns    = []
            for line in lines:
                if acct.account_type in ('ASSET', 'EXPENSE'):
                    running += line.amount if line.side == 'DEBIT' else -line.amount
                else:
                    running += line.amount if line.side == 'CREDIT' else -line.amount

                txns.append({
                    'date':        line.entry.date.isoformat(),
                    'reference':   line.entry.reference,
                    'description': line.description or line.entry.description,
                    'debit':       float(line.amount) if line.side == 'DEBIT'  else 0,
                    'credit':      float(line.amount) if line.side == 'CREDIT' else 0,
                    'balance':     float(running),
                })

            ledger.append({
                'account_code':    acct.code,
                'account_name':    acct.name,
                'account_type':    acct.account_type,
                'closing_balance': float(running),
                'transactions':    txns,
            })

        return Response({'date_from': date_from, 'date_to': date_to, 'accounts': ledger})
