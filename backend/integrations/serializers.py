from rest_framework import serializers
from .models import APIKey, Webhook, WebhookLog


class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = "__all__"
        read_only_fields = ("id", "key", "secret", "created_at")


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class WebhookLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookLog
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")
