import json
import os
from rest_framework import serializers
from ..models import Dealer, DealerCustomerMapping

def _load_states_districts():
    json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'utils', 'indiaStatesDistricts.json')
    with open(json_path, 'r') as f:
        return json.load(f)

_STATES_DISTRICTS = _load_states_districts()


class DealerSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Dealer
        fields = [
            'id',
            'dealer_code',
            'dealer_name',
            'contact_person',
            'contact_number',
            'email',
            'address',
            'city',
            'state',
            'district',
            'zip_code',
            'gst_number',
            'is_active',
            'number_of_licence',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'number_of_licence',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def validate_state(self, value):
        if value and value not in _STATES_DISTRICTS:
            raise serializers.ValidationError(f"'{value}' is not a valid Indian state or union territory.")
        return value

    def validate(self, attrs):
        state = attrs.get('state') or (self.instance.state if self.instance else None)
        district = attrs.get('district')
        if district and state:
            valid_districts = _STATES_DISTRICTS.get(state, [])
            if district not in valid_districts:
                raise serializers.ValidationError({'district': f"'{district}' is not a valid district for {state}."})
        return attrs


class DealerCustomerMappingSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = DealerCustomerMapping
        fields = [
            'id',
            'dealer',
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
        dealer = attrs.get('dealer') or getattr(self.instance, 'dealer', None)
        company = attrs.get('company') or getattr(self.instance, 'company', None)
        if dealer and company:
            existing = DealerCustomerMapping.objects.filter(dealer=dealer, company=company)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError("This dealer is already mapped to the selected company.")
        return attrs
