"""
finance/books_serializers.py
"""
from decimal import Decimal
from rest_framework import serializers
from .books_models import ChartOfAccount, JournalEntry, JournalLine


class ChartOfAccountSerializer(serializers.ModelSerializer):
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    normal_balance       = serializers.SerializerMethodField()
    balance              = serializers.SerializerMethodField()
    parent_name          = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model  = ChartOfAccount
        fields = [
            'id', 'code', 'name', 'account_type', 'account_type_display',
            'parent', 'parent_name', 'description',
            'is_active', 'is_system', 'normal_balance', 'balance',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_system', 'created_at', 'updated_at']

    def get_normal_balance(self, obj):
        return obj.normal_balance

    def get_balance(self, obj):
        return float(obj.running_balance())


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model  = JournalLine
        fields = ['id', 'account', 'account_code', 'account_name',
                  'side', 'amount', 'description']


class JournalEntrySerializer(serializers.ModelSerializer):
    lines            = JournalLineSerializer(many=True, read_only=True)
    created_by_name  = serializers.SerializerMethodField()
    total_debits     = serializers.SerializerMethodField()
    total_credits    = serializers.SerializerMethodField()
    is_balanced      = serializers.SerializerMethodField()
    source_display   = serializers.CharField(source='get_source_display', read_only=True)
    status_display   = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = JournalEntry
        fields = [
            'id', 'date', 'reference', 'description',
            'source', 'source_display', 'status', 'status_display',
            'created_by', 'created_by_name',
            'total_debits', 'total_credits', 'is_balanced',
            'lines', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return None

    def get_total_debits(self, obj):
        return float(obj.total_debits())

    def get_total_credits(self, obj):
        return float(obj.total_credits())

    def get_is_balanced(self, obj):
        return obj.is_balanced()


class JournalLineWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = JournalLine
        fields = ['account', 'side', 'amount', 'description']

    def validate_amount(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value


class JournalEntryWriteSerializer(serializers.ModelSerializer):
    lines = JournalLineWriteSerializer(many=True)

    class Meta:
        model  = JournalEntry
        fields = ['date', 'reference', 'description', 'source', 'lines']

    def validate_lines(self, lines):
        if len(lines) < 2:
            raise serializers.ValidationError(
                'A journal entry must have at least 2 lines (one debit, one credit).'
            )
        debits  = sum(l['amount'] for l in lines if l['side'] == 'DEBIT')
        credits = sum(l['amount'] for l in lines if l['side'] == 'CREDIT')
        if debits != credits:
            raise serializers.ValidationError(
                f'Entry is not balanced: Debits {debits} ≠ Credits {credits}. '
                'Total debits must equal total credits.'
            )
        return lines

    def create(self, validated_data):
        from django.db import transaction
        lines_data = validated_data.pop('lines')
        with transaction.atomic():
            entry = JournalEntry.objects.create(**validated_data)
            for line in lines_data:
                # Validate account belongs to same tenant
                if line['account'].tenant != entry.tenant:
                    raise serializers.ValidationError(
                        f"Account {line['account'].code} does not belong to this workspace."
                    )
                JournalLine.objects.create(entry=entry, **line)
        return entry

    def update(self, instance, validated_data):
        if instance.status == 'POSTED':
            raise serializers.ValidationError('Cannot edit a posted journal entry.')
        from django.db import transaction
        lines_data = validated_data.pop('lines', None)
        with transaction.atomic():
            for attr, val in validated_data.items():
                setattr(instance, attr, val)
            instance.save()
            if lines_data is not None:
                instance.lines.all().delete()
                for line in lines_data:
                    JournalLine.objects.create(entry=instance, **line)
        return instance
