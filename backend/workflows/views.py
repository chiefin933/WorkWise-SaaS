from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.rbac import require_permission
from .models import ApprovalTemplate, ApprovalStep, ApprovalRequest, ApprovalAction
from .serializers import (
    ApprovalTemplateSerializer, ApprovalStepSerializer,
    ApprovalRequestSerializer, ApprovalActionSerializer
)


class ApprovalTemplateViewSet(viewsets.ModelViewSet):
    queryset = ApprovalTemplate.objects.all()
    serializer_class = ApprovalTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), require_permission('settings.roles')()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return ApprovalTemplate.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class ApprovalStepViewSet(viewsets.ModelViewSet):
    queryset = ApprovalStep.objects.all()
    serializer_class = ApprovalStepSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ApprovalStep.objects.filter(template__tenant=self.request.user.tenant)


class ApprovalRequestViewSet(viewsets.ModelViewSet):
    queryset = ApprovalRequest.objects.all()
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN' or user.role == 'HR':
            return ApprovalRequest.objects.filter(tenant=user.tenant)
        return ApprovalRequest.objects.filter(tenant=user.tenant, requester=user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, requester=self.request.user, status='in_progress')

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        approval_request = self.get_object()
        if approval_request.status not in ['pending', 'in_progress']:
            return Response({'detail': 'Cannot cancel this request'}, status=status.HTTP_400_BAD_REQUEST)
        approval_request.status = 'cancelled'
        approval_request.save()
        return Response(ApprovalRequestSerializer(approval_request).data)


class ApprovalActionViewSet(viewsets.ModelViewSet):
    queryset = ApprovalAction.objects.all()
    serializer_class = ApprovalActionSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post']

    def get_queryset(self):
        return ApprovalAction.objects.filter(request__tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        approval_request = serializer.validated_data['request']
        # TODO: Check if user is authorized for this step
        action = serializer.save(actor=self.request.user)
        # Update request status if all steps are done
        if action.action_type == 'reject':
            approval_request.status = 'rejected'
        elif action.action_type == 'approve':
            # TODO: Check if all steps are approved, then mark as approved
            approval_request.status = 'approved'
        approval_request.save()
