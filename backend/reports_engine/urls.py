from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomReportViewSet, ReportExportViewSet

router = DefaultRouter()
router.register(r"custom-reports", CustomReportViewSet)
router.register(r"exports", ReportExportViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
