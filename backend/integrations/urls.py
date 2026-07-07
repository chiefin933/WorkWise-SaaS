from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import APIKeyViewSet, WebhookViewSet, WebhookLogViewSet

router = DefaultRouter()
router.register(r"api-keys", APIKeyViewSet)
router.register(r"webhooks", WebhookViewSet)
router.register(r"webhook-logs", WebhookLogViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
