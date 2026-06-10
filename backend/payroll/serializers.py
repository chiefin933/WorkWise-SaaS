from rest_framework import serializers
from .models import PayrollRun, PayrollItem

class PayrollItemSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    payment_method = serializers.CharField(source='employee.payment_method', read_only=True)
    mpesa_number = serializers.CharField(source='employee.mpesa_number', read_only=True)

    class Meta:
        model = PayrollItem
        fields = '__all__'

class PayrollRunSerializer(serializers.ModelSerializer):
    items = PayrollItemSerializer(many=True, read_only=True)
    item_count = serializers.IntegerField(source='items.count', read_only=True)
    total_net = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = '__all__'
        read_only_fields = ('tenant',)

    def get_total_net(self, obj):
        return float(sum(item.net_pay for item in obj.items.all()))

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].user.tenant
        return super().create(validated_data)
