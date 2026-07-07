from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantBackupViewSet

router = DefaultRouter()
router.register(r"backups", TenantBackupViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
