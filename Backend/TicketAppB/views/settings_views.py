import logging
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import Currency, Settings
from ..serializers import CurrencySerializer, SettingsSerializer
from .utils import _get_authenticated_company_admin, _get_object_or_404


logger = logging.getLogger(__name__)


# ── Currency ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_currencies(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    currencies = Currency.objects.filter(company=company).order_by('id')
    serializer = CurrencySerializer(currencies, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_currency(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    serializer = CurrencySerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(company=company, created_by=user)
        return Response({'message': 'Currency created successfully', 'data': serializer.data}, status=status.HTTP_201_CREATED)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def update_currency(request, pk):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    obj, err = _get_object_or_404(Currency, pk, company)
    if err:
        return err

    serializer = CurrencySerializer(obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=user)
        return Response({'message': 'Currency updated successfully', 'data': serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# ── Settings ──────────────────────────────────────────────────────────────────

@api_view(['GET', 'PUT'])
def get_settings(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    if request.method == 'GET':
        try:
            settings_obj = Settings.objects.get(company=company)
            serializer = SettingsSerializer(settings_obj)
            return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)
        except Settings.DoesNotExist:
            return Response({'message': 'No settings found', 'data': None}, status=status.HTTP_200_OK)

    settings_obj, created = Settings.objects.get_or_create(
        company=company,
        defaults={'created_by': user}
    )
    serializer = SettingsSerializer(settings_obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=user)
        msg = 'Settings created successfully' if created else 'Settings updated successfully'
        return Response({'message': msg, 'data': serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


