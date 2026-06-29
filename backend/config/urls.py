from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from users.views import InviteUserView, RevokeInviteView, RemoveTeamMemberView, TeamMembersView, UserProfileView, NotificationSettingsView, InviteInfoView, NotificationViewSet
from core.views import DashboardStatsView, AuditTrailView
from tenants.views import CompanySettingsView, PayrollConfigView, UpgradePlanView, MpesaExpressPushView, MpesaExpressCallbackView, MpesaExpressStatusView
from employees.views import EmployeeViewSet
from payroll.views import PayrollRunViewSet, StatutoryExportView
from payroll.mpesa_views import B2CCallbackView, MpesaB2CResultView, MpesaB2CTimeoutView
from attendance.views import AttendanceViewSet
from leave.views import LeaveViewSet, LeavePolicyView
from payslips.views import DownloadPayslipView

router = routers.DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'payroll', PayrollRunViewSet, basename='payroll')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'leave', LeaveViewSet, basename='leave')
router.register(r'notifications', NotificationViewSet, basename='notification')


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
    path('api/users/me/', UserProfileView.as_view(), name='user_profile'),
    path('api/users/invite/', InviteUserView.as_view(), name='user_invite'),
    path('api/users/invite/info/', InviteInfoView.as_view(), name='invite_info'),
    path('api/users/team/', TeamMembersView.as_view(), name='team_members'),
    path('api/users/invite/<uuid:pk>/', RevokeInviteView.as_view(), name='revoke_invite'),
    path('api/users/team/<uuid:pk>/remove/', RemoveTeamMemberView.as_view(), name='remove_team_member'),
    path('api/dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('api/settings/company/', CompanySettingsView.as_view(), name='company_settings'),
    path('api/settings/company/upgrade-plan/', UpgradePlanView.as_view(), name='upgrade_plan'),
    path('api/settings/payroll/', PayrollConfigView.as_view(), name='payroll_settings'),
    path('api/settings/notifications/', NotificationSettingsView.as_view(), name='notification_settings'),
    path('api/leave/policy/', LeavePolicyView.as_view(), name='leave_policy'),
    path('api/reports/', include('reports.urls')),
    path('api/webhooks/clerk/', include('users.webhook_urls')),
    path('api/payslips/<uuid:pk>/download/', DownloadPayslipView.as_view(), name='payslip-download'),
    path('api/mpesa/b2c/callback/', B2CCallbackView.as_view(), name='mpesa-b2c-callback'),
    path('api/mpesa/b2c/result/', MpesaB2CResultView.as_view(), name='mpesa_result'),
    path('api/mpesa/b2c/timeout/', MpesaB2CTimeoutView.as_view(), name='mpesa_timeout'),
    path('api/mpesa/stk-push/', MpesaExpressPushView.as_view(), name='stk_push'),
    path('api/mpesa/stk-push-callback/', MpesaExpressCallbackView.as_view(), name='stk_callback'),
    path('api/mpesa/stk-push/status/', MpesaExpressStatusView.as_view(), name='stk_status'),
    path('api/finance/', include('finance.urls')),
    path('api/audit-trail/', AuditTrailView.as_view(), name='audit-trail'),
    path('api/payroll/<uuid:payroll_run_id>/export/<str:export_type>/', StatutoryExportView.as_view(), name='statutory-export'),
    path('api/', include(router.urls)),
]
