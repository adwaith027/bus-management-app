from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model,authenticate
from rest_framework_simplejwt.tokens import RefreshToken,AccessToken
from django.utils import timezone


User=get_user_model()


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
        return Response({"error":"Invalid request"},status=status.HTTP_400_BAD_REQUEST)
    
    username=request.data.get('username')
    password=request.data.get('password')

    if not username or not password:
        return Response({"error":"Please provide username and password"},status=status.HTTP_400_BAD_REQUEST)
    
    user=authenticate(username=username,password=password)

    if not user:
        return Response({"error":"Invalid credentials"},status=status.HTTP_401_UNAUTHORIZED)
    
    # if not user.is_verified:
    #     return Response({"error":"User is not verified"},status=status.HTTP_401_UNAUTHORIZED)
    
    if not user.is_active:
        return Response({'error': 'Account is inactive'}, status=403)
    
    try:
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        refresh=RefreshToken.for_user(user)
        access_token=str(refresh.access_token)
        refresh_token=str(refresh)

        response = Response({"message":"Login Successful",
                "user":{
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': user.role,
                    'is_verified': user.is_verified
                }})

        response.set_cookie(
            key='access_token',
            value=access_token,
            httponly=True,
            # False for HTTP, True for HTTPS
            secure=False,
            samesite='Lax',
            max_age=3600,            
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
    response=Response({"message":"Logged out successfully"})

    response.delete_cookie('access_token',path='/')
    response.delete_cookie('refresh_token',path='/')

    return response


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
            max_age=3600,
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
        return Response({
            'error': 'Not authenticated'
        }, status=401)
    
    return Response({
        'authenticated': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        }
    })