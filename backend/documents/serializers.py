from rest_framework import serializers
from .models import DocumentCategory, Document, DocumentVersion


class DocumentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentCategory
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class DocumentVersionSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.CharField(source='uploaded_by.email', read_only=True)

    class Meta:
        model = DocumentVersion
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class DocumentSerializer(serializers.ModelSerializer):
    versions = DocumentVersionSerializer(many=True, read_only=True)
    uploaded_by_email = serializers.CharField(source='uploaded_by.email', read_only=True)
    employee_name = serializers.CharField(source='employee.name', read_only=True, allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)

    class Meta:
        model = Document
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
