from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.contrib.auth import get_user_model

from ..models import ExecutiveCompanyMapping
from ..serializers import ExecutiveCompanyMappingSerializer, CompanySerializer
from .auth_views import get_user_from_cookie


User = get_user_model()


def _is_superadmin(user):
    return user and user.role == "superadmin"


def _sync_executive_user_active(executive_user_id):
    has_active = ExecutiveCompanyMapping.objects.filter(executive_user_id=executive_user_id, is_active=True).exists()
    User.objects.filter(id=executive_user_id, role='executive_user').update(is_active=has_active)


@api_view(['POST'])
def create_executive_mapping(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ExecutiveCompanyMappingSerializer(data=request.data)
    if serializer.is_valid():
        mapping = serializer.save(created_by=user)
        _sync_executive_user_active(mapping.executive_user_id)
        return Response({'message': 'Mapping created successfully', 'data': ExecutiveCompanyMappingSerializer(mapping).data}, status=status.HTTP_201_CREATED)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_executive_mappings(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    mappings = ExecutiveCompanyMapping.objects.select_related('executive_user', 'company').order_by('id')
    serializer = ExecutiveCompanyMappingSerializer(mappings, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


@api_view(['PUT'])
def update_executive_mapping(request, pk):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        mapping = ExecutiveCompanyMapping.objects.get(pk=pk)
    except ExecutiveCompanyMapping.DoesNotExist:
        return Response({'message': 'Mapping not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ExecutiveCompanyMappingSerializer(mapping, data=request.data, partial=True)
    if serializer.is_valid():
        mapping = serializer.save()
        _sync_executive_user_active(mapping.executive_user_id)
        return Response({'message': 'Mapping updated successfully', 'data': serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def executive_dashboard(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if user.role != 'executive_user':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    mappings = ExecutiveCompanyMapping.objects.filter(
        executive_user_id=user.id,
        is_active=True
    ).select_related('company')

    companies = [m.company for m in mappings]
    serializer = CompanySerializer(companies, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)
