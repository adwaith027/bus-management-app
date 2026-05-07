from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.db.models import Q as models_Q
from ..models import Company, CustomUser, DealerCustomerMapping
from ..serializers import UserSerializer
from django.contrib.auth import get_user_model
from .auth_views import get_user_from_cookie
from .utils import _is_superadmin, _is_dealer_admin, _is_company_admin
from datetime import datetime


User = get_user_model()


# ── Permission matrix ─────────────────────────────────────────────────────────
# superadmin    → can create: executive, company_admin (own companies only)
# dealer_admin  → can create: company_admin (their mapped companies only)
# company_admin → can create: user (own company only, auto-set)
# nobody        → creates superadmin
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def create_user(request):
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if not request.data:
        return Response({'error': 'Invalid Input'}, status=status.HTTP_400_BAD_REQUEST)

    username = request.data.get('username')
    email    = request.data.get('email')
    role     = request.data.get('role')
    password = request.data.get('password')
    company_id = request.data.get('company_id')

    if not all([username, email, role, password]):
        return Response({'error': 'username, email, role, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Nobody may create a superadmin account
    if role == 'superadmin':
        return Response({'error': 'Creating superadmin accounts is not allowed.'}, status=status.HTTP_403_FORBIDDEN)

    company_instance = None

    if _is_superadmin(requester):
        # Can create executive (no company) or company_admin (own companies only)
        if role not in ('executive', 'company_admin'):
            return Response({'error': 'Superadmin can only create executive or company_admin users.'}, status=status.HTTP_403_FORBIDDEN)
        if role == 'company_admin':
            if not company_id:
                return Response({'error': 'company_id is required for company_admin.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                company_instance = Company.objects.get(id=company_id, created_by=requester)
            except Company.DoesNotExist:
                return Response({'error': 'Company not found or not owned by you.'}, status=status.HTTP_403_FORBIDDEN)

    elif _is_dealer_admin(requester):
        # Can only create company_admin for their mapped companies
        if role != 'company_admin':
            return Response({'error': 'Dealer admin can only create company_admin users.'}, status=status.HTTP_403_FORBIDDEN)
        if not company_id:
            return Response({'error': 'company_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not requester.dealer_id:
            return Response({'error': 'No dealer linked to this account.'}, status=status.HTTP_400_BAD_REQUEST)
        mapped = DealerCustomerMapping.objects.filter(
            dealer_id=requester.dealer_id, company_id=company_id, is_active=True
        ).exists()
        if not mapped:
            return Response({'error': 'Company not found or not under your dealer.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            company_instance = Company.objects.get(id=company_id)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found.'}, status=status.HTTP_404_NOT_FOUND)

    elif _is_company_admin(requester):
        # Can only create user-role accounts, always scoped to own company
        if role != 'user':
            return Response({'error': 'Company admin can only create regular users.'}, status=status.HTTP_403_FORBIDDEN)
        if not requester.company:
            return Response({'error': 'No company linked to this account.'}, status=status.HTTP_400_BAD_REQUEST)
        company_instance = requester.company  # force own company regardless of input

    else:
        return Response({'error': 'You do not have permission to create users.'}, status=status.HTTP_403_FORBIDDEN)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        new_user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            company=company_instance,
            role=role,
        )
        new_user.save()
        return Response({"message": "User added successfully"}, status=status.HTTP_201_CREATED)
    except Exception:
        return Response({"message": "User creation failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['GET'])
def get_all_users(request):
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if _is_superadmin(requester):
        # Own-created company_admins + executives + dealer_admins (all dealers, created by superadmin)
        own_company_ids = Company.objects.filter(created_by=requester).values_list('id', flat=True)
        users = CustomUser.objects.filter(
            models_Q(role='company_admin', company_id__in=own_company_ids) |
            models_Q(role='executive') |
            models_Q(role='dealer_admin')
        ).order_by('id')

    elif _is_dealer_admin(requester):
        if not requester.dealer_id:
            return Response({'error': 'No dealer linked.'}, status=status.HTTP_400_BAD_REQUEST)
        mapped_company_ids = DealerCustomerMapping.objects.filter(
            dealer_id=requester.dealer_id, is_active=True
        ).values_list('company_id', flat=True)
        users = CustomUser.objects.filter(
            role='company_admin', company_id__in=mapped_company_ids
        ).order_by('id')

    elif _is_company_admin(requester):
        if not requester.company:
            return Response({'error': 'No company linked.'}, status=status.HTTP_400_BAD_REQUEST)
        users = CustomUser.objects.filter(role='user', company=requester.company).order_by('id')

    else:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    serializer = UserSerializer(users, many=True)
    return Response({"message": "Success", "data": serializer.data}, status=status.HTTP_200_OK)


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
    if role != 'executive':
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
