from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from core.rbac import require_permission
from employees.models import Employee
from .models import DocumentCategory, Document, DocumentVersion
from .serializers import (
    DocumentCategorySerializer, DocumentSerializer, DocumentVersionSerializer
)


class DocumentCategoryViewSet(viewsets.ModelViewSet):
    queryset = DocumentCategory.objects.all()
    serializer_class = DocumentCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), require_permission('settings.roles')()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return DocumentCategory.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Document.objects.filter(tenant=user.tenant)
        # If employee, only their own documents
        try:
            employee = Employee.objects.get(user=user, tenant=user.tenant)
            return Document.objects.filter(tenant=user.tenant, employee=employee)
        except Employee.DoesNotExist:
            return Document.objects.filter(tenant=user.tenant, uploaded_by=user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, uploaded_by=self.request.user)


class DocumentVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DocumentVersion.objects.all()
    serializer_class = DocumentVersionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DocumentVersion.objects.filter(document__tenant=self.request.user.tenant)
