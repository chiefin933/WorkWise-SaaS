from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApprovalTemplateViewSet, ApprovalStepViewSet, ApprovalRequestViewSet, ApprovalActionViewSet

router = DefaultRouter()
router.register(r'templates', ApprovalTemplateViewSet)
router.register(r'steps', ApprovalStepViewSet)
router.register(r'requests', ApprovalRequestViewSet)
router.register(r'actions', ApprovalActionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
