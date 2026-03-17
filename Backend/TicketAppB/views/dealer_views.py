from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.contrib.auth import get_user_model

from ..models import Dealer, DealerCustomerMapping, Company, CustomUser
from ..serializers import DealerSerializer, DealerCustomerMappingSerializer, CompanySerializer
from .auth_views import get_user_from_cookie


User = get_user_model()


def _is_superadmin(user):
    return user and user.role == "superadmin"


def _sync_dealer_users_active(dealer_id):
    has_active = DealerCustomerMapping.objects.filter(dealer_id=dealer_id, is_active=True).exists()
    CustomUser.objects.filter(dealer_id=dealer_id, role='dealer_user').update(is_active=has_active)


@api_view(['POST'])
def create_dealer(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    if not request.data:
        return Response({'error': 'Invalid Input'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = DealerSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    # Dealer user details
    username = request.data.get('user_username')
    email = request.data.get('user_email')
    password = request.data.get('user_password')

    if not username or not email or not password:
        return Response({'message': 'Dealer user details missing'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'message': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({'message': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    dealer = serializer.save(created_by=user)

    dealer_user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        role='dealer_user',
        dealer=dealer,
        is_verified=True
    )
    dealer_user.save()

    return Response({'message': 'Dealer created successfully', 'data': serializer.data}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def get_all_dealers(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    dealers = Dealer.objects.all().order_by('id')
    serializer = DealerSerializer(dealers, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


@api_view(['PUT'])
def update_dealer_details(request, pk):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        dealer = Dealer.objects.get(pk=pk)
    except Dealer.DoesNotExist:
        return Response({'message': 'Dealer not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = DealerSerializer(dealer, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'Dealer updated successfully', 'data': serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def create_dealer_mapping(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DealerCustomerMappingSerializer(data=request.data)
    if serializer.is_valid():
        mapping = serializer.save(created_by=user)
        _sync_dealer_users_active(mapping.dealer_id)
        return Response({'message': 'Mapping created successfully', 'data': DealerCustomerMappingSerializer(mapping).data}, status=status.HTTP_201_CREATED)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_dealer_mappings(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    mappings = DealerCustomerMapping.objects.select_related('dealer', 'company').order_by('id')
    serializer = DealerCustomerMappingSerializer(mappings, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


@api_view(['PUT'])
def update_dealer_mapping(request, pk):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        mapping = DealerCustomerMapping.objects.get(pk=pk)
    except DealerCustomerMapping.DoesNotExist:
        return Response({'message': 'Mapping not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = DealerCustomerMappingSerializer(mapping, data=request.data, partial=True)
    if serializer.is_valid():
        mapping = serializer.save()
        _sync_dealer_users_active(mapping.dealer_id)
        return Response({'message': 'Mapping updated successfully', 'data': serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def dealer_dashboard(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if user.role != 'dealer_user':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    if not user.dealer_id:
        return Response({'message': 'No dealer mapped to user'}, status=status.HTTP_400_BAD_REQUEST)

    mappings = DealerCustomerMapping.objects.filter(
        dealer_id=user.dealer_id,
        is_active=True
    ).select_related('company')

    companies = [m.company for m in mappings]
    serializer = CompanySerializer(companies, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)
