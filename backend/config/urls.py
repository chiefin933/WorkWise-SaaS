from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from users.views import CustomTokenObtainPairView, RegisterView, UserProfileView
from core.views import DashboardStatsView, AuditTrailView
from tenants.views import CompanySettingsView, PayrollConfigView, UpgradePlanView, MpesaExpressPushView, MpesaExpressCallbackView, MpesaExpressStatusView
from employees.views import EmployeeViewSet
from payroll.views import PayrollRunViewSet
from payroll.mpesa_views import B2CCallbackView, MpesaB2CResultView, MpesaB2CTimeoutView
from attendance.views import AttendanceViewSet
from leave.views import LeaveViewSet
from payslips.views import DownloadPayslipView
from rest_framework_simplejwt.views import TokenRefreshView

router = routers.DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'payroll', PayrollRunViewSet, basename='payroll')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'leave', LeaveViewSet, basename='leave')

from django.http import JsonResponse

def api_root(request):
    return JsonResponse({
        "status": "healthy",
        "name": "WorkWise SaaS API Backend",
        "version": "1.0.0",
        "services": {
            "admin": "/admin/",
            "api": "/api/"
        }
    })

urlpatterns = [
    path('', api_root, name='api_root'),
    path('admin/', admin.site.urls),
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/users/me/', UserProfileView.as_view(), name='user_profile'),
    path('api/dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('api/settings/company/', CompanySettingsView.as_view(), name='company_settings'),
    path('api/settings/company/upgrade-plan/', UpgradePlanView.as_view(), name='upgrade_plan'),
    path('api/settings/payroll/', PayrollConfigView.as_view(), name='payroll_settings'),
    path('api/reports/', include('reports.urls')),
    path('api/webhooks/clerk/', include('users.webhook_urls')),
    path('api/payslips/<uuid:pk>/download/', DownloadPayslipView.as_view(), name='payslip-download'),
    path('api/mpesa/b2c/callback/', B2CCallbackView.as_view(), name='mpesa-b2c-callback'),
    path('api/mpesa/b2c/result/', MpesaB2CResultView.as_view(), name='mpesa_result'),
    path('api/mpesa/b2c/timeout/', MpesaB2CTimeoutView.as_view(), name='mpesa_timeout'),
    path('api/mpesa/stk-push/', MpesaExpressPushView.as_view(), name='stk_push'),
    path('api/mpesa/stk-push-callback/', MpesaExpressCallbackView.as_view(), name='stk_callback'),
    path('api/mpesa/stk-push/status/', MpesaExpressStatusView.as_view(), name='stk_status'),
    path('api/audit-trail/', AuditTrailView.as_view(), name='audit-trail'),
    path('api/', include(router.urls)),
]
