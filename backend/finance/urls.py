from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ExpenseClaimViewSet,
    DepartmentBudgetViewSet,
    PettyCashFundViewSet,
    FinancialSummaryView,
)
from .books_views import (
    ChartOfAccountViewSet,
    JournalEntryViewSet,
    TrialBalanceView,
    IncomeStatementView,
    BalanceSheetView,
    GeneralLedgerView,
)

router = DefaultRouter()
router.register(r'expenses',    ExpenseClaimViewSet,    basename='expense')
router.register(r'budgets',     DepartmentBudgetViewSet, basename='budget')
router.register(r'petty-cash',  PettyCashFundViewSet,   basename='petty-cash')
router.register(r'accounts',    ChartOfAccountViewSet,  basename='account')
router.register(r'journal',     JournalEntryViewSet,    basename='journal')

urlpatterns = [
    path('summary/',           FinancialSummaryView.as_view(),  name='finance-summary'),
    path('trial-balance/',     TrialBalanceView.as_view(),      name='trial-balance'),
    path('income-statement/',  IncomeStatementView.as_view(),   name='income-statement'),
    path('balance-sheet/',     BalanceSheetView.as_view(),      name='balance-sheet'),
    path('general-ledger/',    GeneralLedgerView.as_view(),     name='general-ledger'),
    path('', include(router.urls)),
]
