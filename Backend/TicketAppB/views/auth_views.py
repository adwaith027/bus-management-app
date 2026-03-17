import secrets
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model,authenticate
from rest_framework_simplejwt.tokens import RefreshToken,AccessToken
from datetime import date
from ..models import Company, UserDeviceMapping

User=get_user_model()


def _classify_device_type(user_agent):
    agent = (user_agent or "").lower()
    if "android" in agent:
        return UserDeviceMapping.DeviceType.ANDROID
    if "iphone" in agent or "ipad" in agent or "ios" in agent:
        return UserDeviceMapping.DeviceType.IOS
    if any(token in agent for token in ["mobile", "opera mini", "blackberry", "iemobile"]):
        return UserDeviceMapping.DeviceType.WEB_MOBILE
    if agent:
        return UserDeviceMapping.DeviceType.WEB_DESKTOP
    return UserDeviceMapping.DeviceType.UNKNOWN


def _set_user_device_validity(user):
    has_approved_device = UserDeviceMapping.objects.filter(
        user=user,
        status=UserDeviceMapping.DeviceStatus.APPROVED,
    ).exists()
    if user.is_device_valid != has_approved_device:
        user.is_device_valid = has_approved_device
        user.save(update_fields=["is_device_valid"])
    return has_approved_device


def _generate_unique_device_uid():
    while True:
        device_uid = secrets.token_urlsafe(24)
        if not UserDeviceMapping.objects.filter(device_uid=device_uid).exists():
            return device_uid


def _create_pending_mapping(user, device_type, user_agent, device_uid):
    mapping = UserDeviceMapping.objects.create(
        user=user,
        username_snapshot=user.username,
        device_uid=device_uid,
        device_type=device_type,
        user_agent=user_agent,
        status=UserDeviceMapping.DeviceStatus.PENDING,
        last_seen_at=timezone.now(),
    )
    return mapping


def _build_logout_response(message):
    response = Response({"message": message})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return response


@api_view(['POST'])
def signup_view(request):
    if not request.data:
        return Response({'error': 'Invalid Input'}, status=status.HTTP_400_BAD_REQUEST)
    
    username=request.data.get('username')
    email=request.data.get('mailid')
    role=request.data.get('role','user')
    password=request.data.get('password')
    cpassword=request.data.get('cpassword')

    if not username or not email or not password or not cpassword:
        return Response({"error":"Fill out all the fields"},status=status.HTTP_400_BAD_REQUEST)
    
    if password != cpassword:
        return Response({"error":"Passwords do not match"},status=status.HTTP_400_BAD_REQUEST)
    
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # password auto hashed by create_user
        user=User.objects.create_user(username=username,email=email,password=password,role=role,is_verified=True)
        return Response({'message': 'Account created successfully.',
            'user': {
                'username': user.username,
                'email': user.email,
                'role': user.role
            }
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({"error":"Failed to create user"},status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

@api_view(['POST'])
def login_view(request):
    if not request.data:
        return Response({"error":"Invalid request.No credentials provided"},status=status.HTTP_400_BAD_REQUEST)
    
    username=request.data.get('username')
    password=request.data.get('password')

    if not username or not password:
        return Response({"error":"Please provide username and password"},status=status.HTTP_400_BAD_REQUEST)
    
    user=authenticate(username=username,password=password)

    if not user:
        # If credentials are correct but account is inactive, authenticate() returns None.
        # Provide a clearer error for inactive accounts.
        try:
            existing_user = User.objects.get(username=username)
            if not existing_user.is_active:
                return Response({"error":"Account is inactive. Contact administrator."},status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            pass
        return Response({"error":"Invalid credentials"},status=status.HTTP_401_UNAUTHORIZED)
    
    # if not user.is_verified:
    #     return Response({"error":"User is not verified"},status=status.HTTP_401_UNAUTHORIZED)
    
    if not user.is_active:
        return Response({'error': 'Account is inactive'}, status=403)
    
    # get company for license validation
    company=user.company
    if company:
        if company.product_to_date:
            if date.today()>company.product_to_date:
                return Response({"error":"License Expired. Contact Administrator"},status=status.HTTP_403_FORBIDDEN)
        
        if company.authentication_status:
            if company.authentication_status!=Company.AuthStatus.APPROVED:
                return Response({"error":"Pending License Approval. Contact Administrator"},status=status.HTTP_403_FORBIDDEN)

    user_agent = request.headers.get("User-Agent", "")
    device_type = _classify_device_type(user_agent)
    device_uid = request.data.get("device_uid")

    if user.role != "superadmin":
        if not device_uid:
            generated_uid = _generate_unique_device_uid()
            pending_mapping = _create_pending_mapping(
                user=user,
                device_type=device_type,
                user_agent=user_agent,
                device_uid=generated_uid,
            )
            return Response(
                {
                    "error_code": "DEVICE_REGISTRATION_REQUIRED",
                    "error": "Login from this device is unauthorized",
                    "message": "Device registration created. Wait for approval and retry login.",
                    "details": {
                        "device_uid": pending_mapping.device_uid,
                        "device_type": pending_mapping.device_type,
                        "status": pending_mapping.status,
                    },
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        mapping = UserDeviceMapping.objects.filter(device_uid=device_uid).select_related("user").first()
        if mapping and mapping.user_id != user.id:
            return Response(
                {
                    "error_code": "DEVICE_UID_ALREADY_BOUND",
                    "error": "This device UID is already linked to another user.",
                    "message": "This device is linked to another user. Release device from current user before trying again.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not mapping:
            return Response(
                {
                    "error_code": "DEVICE_UID_INVALID_OR_RELEASED",
                    "error": "Invalid or released device UID",
                    "message": "This device UID is not valid anymore. Login without device UID to register this device again.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            mapping.last_seen_at = timezone.now()
            mapping.username_snapshot = user.username
            mapping.device_type = device_type
            mapping.user_agent = user_agent
            mapping.save(
                update_fields=[
                    "last_seen_at",
                    "username_snapshot",
                    "device_type",
                    "user_agent",
                    "updated_at",
                ]
            )
        except Exception:
            return Response(
                {"error": "Failed to process device mapping"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if mapping.status != UserDeviceMapping.DeviceStatus.APPROVED:
            return Response(
                {
                    "error_code": "DEVICE_UNAUTHORIZED",
                    "error": "Login from this device is unauthorized",
                    "message": "Device not approved. Contact superadmin.",
                    "details": {
                        "device_uid": mapping.device_uid,
                        "device_type": mapping.device_type,
                        "status": mapping.status,
                    },
                },
                status=status.HTTP_403_FORBIDDEN,
            )

    try:
        _set_user_device_validity(user)
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        refresh=RefreshToken.for_user(user)
        access_token=str(refresh.access_token)
        refresh_token=str(refresh)

        valid_till = None
        if company and company.product_to_date:
            valid_till = company.product_to_date.strftime("%d-%m-%Y")

        response = Response({"message":"Login Successful",
                "user":{
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': user.role,
                    'is_verified': user.is_verified,
                    'is_device_valid': user.is_device_valid,
                    'company_name': company.company_name if company else None,
                    "valid_till":valid_till,
                    'license_status':company.authentication_status if company else None
                }})

        response.set_cookie(
            key='access_token',
            value=access_token,
            httponly=True,
            # False for HTTP, True for HTTPS
            secure=False,
            samesite='Lax',
            max_age=1800,            
            path='/'
        )

        response.set_cookie(
            key='refresh_token',
            value=refresh_token,
            httponly=True,
            # False for HTTP, True for HTTPS
            secure=False,
            samesite='Lax',
            max_age=604800,         
            path='/'
        )
        
        return response
    
    except Exception as e:
        return Response({"message":"Login Failed. Try again later"},status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def logout_view(request):
    return _build_logout_response("Logged out successfully")


@api_view(['POST'])
def release_device_view(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {"error_code": "AUTH_REQUIRED", "error": "Authentication required"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    device_uid = request.data.get("device_uid")
    mapping = None

    if device_uid:
        mapping = UserDeviceMapping.objects.filter(device_uid=device_uid).select_related("user").first()
    else:
        mapping = (
            UserDeviceMapping.objects.filter(user=user)
            .order_by("-last_seen_at", "-updated_at")
            .first()
        )

    if not mapping:
        return Response(
            {"error_code": "DEVICE_MAPPING_NOT_FOUND", "error": "No device mapping found for release"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if mapping.user_id != user.id:
        return Response(
            {"error_code": "DEVICE_RELEASE_NOT_ALLOWED", "error": "You cannot release another user's device"},
            status=status.HTTP_403_FORBIDDEN,
        )

    mapping.delete()
    _set_user_device_validity(user)

    return _build_logout_response("RELEASE_SUCCESS")


@api_view(['GET'])
def protected_view(request):
    # Read access token from cookies
    access_token = request.COOKIES.get('access_token')
    
    if not access_token:
        return Response({'error': 'No access token provided'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Validate token and get user
        token = AccessToken(access_token)
        user_id = token['user_id']
        user = User.objects.get(id=user_id)
        
        return Response({'message': f'Hello {user.username}!',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role
            }
        })
        
    except TokenError:
        return Response({'error': 'Invalid or expired token'}, status=status.HTTP_401_UNAUTHORIZED)
    
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_400_BAD_REQUEST)
    

# Extract and validate access token from cookies
def get_user_from_cookie(request):
    access_token = request.COOKIES.get('access_token')

    if not access_token:
        return None

    # Returns user object or None    
    try:
        token = AccessToken(access_token)
        user_id = token['user_id']
        user = User.objects.get(id=user_id)
        return user
    except (TokenError, User.DoesNotExist):
        return None


# Generates new access token using refresh token from cookies
@api_view(['POST'])
def refresh_token_view(request):
    # No body required - reads refresh_token from cookies
    refresh_token = request.COOKIES.get('refresh_token')
    
    if not refresh_token:
        return Response({'error': 'No refresh token found'}, status=401)
    
    try:
        # Validate refresh token and generate new access token
        refresh = RefreshToken(refresh_token)
        new_access_token = str(refresh.access_token)
        
        # Create response
        response = Response({
            'message': 'Token refreshed successfully'
        })
        
        # Set new access token cookie
        response.set_cookie(
            key='access_token',
            value=new_access_token,
            httponly=True,
            secure=False,
            samesite='Lax',
            max_age=1800,
            path='/'
        )

        return response
        
    except TokenError as e:
        return Response({'error': 'Invalid or expired refresh token'}, status=401)
    

# Now returns user role for frontend role-based access control
@api_view(['GET'])
def verify_auth(request):
    user = get_user_from_cookie(request)
    
    if not user:
        return Response({'error': 'Not authenticated'}, status=401)
    
    company = user.company
    valid_till = None
    if company and company.product_to_date:
        valid_till = company.product_to_date.strftime("%d-%m-%Y")
    
    return Response({
        'authenticated': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'is_verified': user.is_verified,
            'is_device_valid': user.is_device_valid,
            'company_name': company.company_name if company else None,
            'valid_till': valid_till,
            'license_status': company.authentication_status if company else None
        }
    })
