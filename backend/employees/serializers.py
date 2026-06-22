import re
from rest_framework import serializers
from .models import Employee

KRA_PIN_REGEX = re.compile(r'^[A-Z]\d{9}[A-Z]$')


class EmployeeSerializer(serializers.ModelSerializer):
    bank_details = serializers.JSONField(required=False, default=dict)

    class Meta:
        model = Employee
        fields = '__all__'
        read_only_fields = ('tenant',)

    def validate_kra_pin(self, value):
        if not value:
            return value
        cleaned = value.strip().upper()
        if not KRA_PIN_REGEX.match(cleaned):
            raise serializers.ValidationError(
                'KRA PIN must be in the format A001234567X '
                '(one letter, nine digits, one letter). Example: A001234567X'
            )
        return cleaned

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].user.tenant
        return super().create(validated_data)


class EmployeeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        exclude = ('kra_pin', 'mpesa_number', 'bank_details', 'national_id')
