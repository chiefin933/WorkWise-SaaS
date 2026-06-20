from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExpenseClaimViewSet,
    DepartmentBudgetViewSet,
    PettyCashFundViewSet,
    FinancialSummaryView,
)

router = DefaultRouter()
router.register(r'expenses',    ExpenseClaimViewSet,    basename='expense')
router.register(r'budgets',     DepartmentBudgetViewSet, basename='budget')
router.register(r'petty-cash',  PettyCashFundViewSet,   basename='petty-cash')

urlpatterns = [
    path('summary/', FinancialSummaryView.as_view(), name='finance-summary'),
    path('', include(router.urls)),
]
