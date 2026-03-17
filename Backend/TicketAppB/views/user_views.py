from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from ..models import Company,CustomUser
from ..serializers import UserSerializer
from django.contrib.auth import get_user_model
from .auth_views import get_user_from_cookie
from datetime import datetime


User=get_user_model()


@api_view(['POST'])
def create_user(request):
    # verify user
    user=get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:        
        if not request.data:
            return Response({'error': 'Invalid Input'}, status=status.HTTP_400_BAD_REQUEST)
        
        username=request.data.get('username')
        email=request.data.get('email')
        role=request.data.get('role')
        company=request.data.get('company_id')
        password=request.data.get('password')

        company_instance = None
        if role != 'executive_user':
            try:
                company_instance = Company.objects.get(id=company)
            except Company.DoesNotExist:
                return Response({"message": "Invalid Company Given"},status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            company=company_instance,
            role=role
        )
        user.save()

        return Response({"message":"User added successfully"},status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({"message":"User creation failed"},status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['GET'])
def get_all_users(request):
    # verify user
    user=get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    users=CustomUser.objects.all().order_by('id')

    serializer = UserSerializer(users, many=True)

    return Response({"message": "Success","data": serializer.data},status=status.HTTP_200_OK)


@api_view(['PUT'])
def update_user(request, user_id):
    # verify user
    user=get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    username=request.data.get('username')
    email      = request.data.get('email')
    role       = request.data.get('role')
    company_id = request.data.get('company_id')
    if not all([username, email, role]):
        return Response({'error': "Missing required fields"}, status=status.HTTP_401_UNAUTHORIZED)

    # check if user exists
    try:
        user_data=User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"status": "error","message": "User not found","error": f"No user found with ID {user_id}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # check if username exists(filter out our user)
    if User.objects.filter(username=username).exclude(pk=user_id).exists():
        return Response({'status': 'error','message': 'Username already exists','error': 'This username is already taken by another user'}, status=status.HTTP_400_BAD_REQUEST)

    # check if email exists(filter out our user)
    if User.objects.filter(email=email).exclude(pk=user_id).exists():
        return Response({'status': 'error','message': 'Email already exists','error': 'This email is already registered to another user'}, status=status.HTTP_400_BAD_REQUEST)

    company_instance = None
    if role != 'executive_user':
        # check if company exists
        try:
            company_instance=Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
            return Response({"status": "error","message": "Company not found","error": f"No company found with ID {company_id}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:        
        user_data.username=username
        user_data.email=email
        user_data.role=role
        user_data.company=company_instance

        user_data.save()
        response_data={
            'id': user_data.id,
            'username': user_data.username,
            'email': user_data.email,
            'role': user_data.role,
            'company': user_data.company.id,
            'company_name': user_data.company.company_name
        }

        return Response({"status": "success","message": "User updated successfully","data": response_data},status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({'status': 'error','message': 'Update failed','error': 'An error occurred while updating the user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def change_user_password(request,user_id):
    # verify user
    user=get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if user.role!="superadmin":
        return Response({"status": "error","message": "Unauthorized","error": "You don't have permission to change this user's password"}, status=status.HTTP_401_UNAUTHORIZED)

    new_password=request.data.get('new_password')
    if not new_password:
        return Response({'error': "Missing password input"}, status=status.HTTP_400_BAD_REQUEST)
    
    if not len(new_password)>=8:
        return Response({"status": "error","message": "Password validation failed","error": "Password must be at least 8 characters long"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_data=User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"status": "error","message": "User not found","error": f"No user found with ID {user_id}"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        password_changed_at=datetime.strftime(datetime.now(),'%Y-%m-%d %H:%M:%S')

        user_data.set_password(new_password)
        user_data.save()
        
        response_data={
            "user_id": user_data.id,
            "username": user_data.username,
            "password_changed_at": password_changed_at
        }

        return Response({"status": "success","message": "Password changed successfully","data": response_data},status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({'status': 'error','message': 'Update failed','error': 'An error occurred while updating password'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
