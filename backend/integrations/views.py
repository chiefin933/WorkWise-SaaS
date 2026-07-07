import requests
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.rbac import require_permission
from .models import APIKey, Webhook, WebhookLog
from .serializers import APIKeySerializer, WebhookSerializer, WebhookLogSerializer


class APIKeyViewSet(viewsets.ModelViewSet):
    queryset = APIKey.objects.all()
    serializer_class = APIKeySerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), require_permission("settings.roles")()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return APIKey.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)


class WebhookViewSet(viewsets.ModelViewSet):
    queryset = Webhook.objects.all()
    serializer_class = WebhookSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), require_permission("settings.roles")()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Webhook.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def trigger_test(self, request, pk=None):
        webhook = self.get_object()
        test_payload = {
            "event": "test",
            "tenant_id": str(webhook.tenant.id),
            "message": "Test webhook trigger",
        }
        log = WebhookLog.objects.create(
            tenant=webhook.tenant,
            webhook=webhook,
            event="test",
            payload=test_payload,
            status="pending",
        )
        self._send_webhook(webhook, log)
        return Response({"status": "Test webhook sent"})

    def _send_webhook(self, webhook, log):
        try:
            import json
            payload_str = json.dumps(log.payload)
            headers = {
                "Content-Type": "application/json",
                "X-WorkWise-Signature": webhook.generate_signature(payload_str),
            }
            response = requests.post(webhook.url, data=payload_str, headers=headers, timeout=10)
            log.status_code = response.status_code
            log.response = response.text
            if response.status_code in [200, 201, 204]:
                log.status = "success"
            else:
                log.status = "failed"
        except Exception as e:
            log.status = "failed"
            log.response = str(e)
        log.save()


class WebhookLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WebhookLog.objects.all()
    serializer_class = WebhookLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WebhookLog.objects.filter(tenant=self.request.user.tenant)
