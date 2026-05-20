from rest_framework import serializers
from ..models import ExecutiveCompanyMapping


class ExecutiveCompanyMappingSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ExecutiveCompanyMapping
        fields = [
            'id',
            'executive_user',
            'company',
            'is_active',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        executive_user = attrs.get('executive_user') or getattr(self.instance, 'executive_user', None)
        company = attrs.get('company') or getattr(self.instance, 'company', None)
        if executive_user and executive_user.role != 'executive':
            raise serializers.ValidationError("Selected user does not have the executive role.")
        if executive_user and company:
            existing = ExecutiveCompanyMapping.objects.filter(executive_user=executive_user, company=company)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError("This executive user is already mapped to the selected company.")
        return attrs
