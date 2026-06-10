from rest_framework import serializers
from .models import Employee

class EmployeeSerializer(serializers.ModelSerializer):
    bank_details = serializers.JSONField(required=False, default=dict)

    class Meta:
        model = Employee
        fields = '__all__'
        read_only_fields = ('tenant',)

    def create(self, validated_data):
        # Automatically assign the tenant of the logged-in user
        validated_data['tenant'] = self.context['request'].user.tenant
        return super().create(validated_data)
