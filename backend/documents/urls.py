from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentCategoryViewSet, DocumentViewSet, DocumentVersionViewSet

router = DefaultRouter()
router.register(r'categories', DocumentCategoryViewSet)
router.register(r'documents', DocumentViewSet)
router.register(r'versions', DocumentVersionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
