from rest_framework import serializers
from ..models import CustomUser, UserDeviceMapping


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = '__all__'


class UserDeviceMappingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    company_name = serializers.CharField(source='user.company.company_name', read_only=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True)

    class Meta:
        model = UserDeviceMapping
        fields = [
            'id',
            'user',
            'username',
            'company_name',
            'username_snapshot',
            'device_uid',
            'device_type',
            'user_agent',
            'status',
            'is_active',
            'approved_by',
            'approved_by_username',
            'approved_at',
            'last_seen_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
