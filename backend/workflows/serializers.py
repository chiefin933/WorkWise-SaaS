from rest_framework import serializers
from .models import ApprovalTemplate, ApprovalStep, ApprovalRequest, ApprovalAction


class ApprovalStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalStep
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class ApprovalTemplateSerializer(serializers.ModelSerializer):
    steps = ApprovalStepSerializer(many=True, read_only=True)

    class Meta:
        model = ApprovalTemplate
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class ApprovalActionSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source='actor.email', read_only=True)

    class Meta:
        model = ApprovalAction
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class ApprovalRequestSerializer(serializers.ModelSerializer):
    actions = ApprovalActionSerializer(many=True, read_only=True)
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True, allow_null=True)

    class Meta:
        model = ApprovalRequest
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
