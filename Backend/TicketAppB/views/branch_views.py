from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from ..models import Company,Branch,CustomUser
from ..serializers import BranchSerializer
from django.contrib.auth import get_user_model
from .auth_views import get_user_from_cookie
import logging
from django.http import HttpResponse,JsonResponse


# Setup logger
logger = logging.getLogger(__name__)
User = get_user_model()


@api_view(['GET'])
def get_all_branches(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    company_instance = user.company
    if not company_instance:
        return Response(
            {"message": "No company mapped to user."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        branches = Branch.objects.filter(company=company_instance).order_by('id')
    except Exception as e:
        logger.error(f"Error fetching branches: {str(e)}")
        return Response(
            {"message": "Error fetching branches"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    serializer = BranchSerializer(branches, many=True)
    return Response(
        {
            "message": "Branches fetched successfully",
            "data": serializer.data
        },
        status=status.HTTP_200_OK
    )


# Create a new branch
@api_view(['POST'])
def create_branch(request):

    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {'error': 'Authentication required'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.data:
        return Response(
            {"message": "No input received"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    serializer = BranchSerializer(data=request.data)
    
    if serializer.is_valid():
        company_instance = user.company
        if not company_instance:
            return Response(
                {
                    "message": "No company to map branch to (User has no mapped company).",
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        branch = serializer.save(company=company_instance, created_by=user)
        logger.info(f"Created new branch: {branch.branch_name} (ID: {branch.id})")
        return Response(
            {
                "message": "Branch created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )
    
    logger.warning(f"Branch creation failed: {serializer.errors}")
    return Response(
        {
            "message": "Validation failed",
            "errors": serializer.errors
        },
        status=status.HTTP_400_BAD_REQUEST
    )


# update a branch
@api_view(['PUT'])
def update_branch_details(request, pk):

    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {'error': 'Authentication required'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        branch = Branch.objects.get(pk=pk)
    except Branch.DoesNotExist:
        logger.error(f"Branch not found for update with ID: {pk}")
        return Response(
            {"message": "Branch not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    serializer = BranchSerializer(branch, data=request.data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        logger.info(f"Updated branch: {branch.branch_name} (ID: {pk})")
        return Response(
            {
                "message": "Branch updated successfully", 
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )
    
    logger.warning(f"Branch update failed for ID {pk}: {serializer.errors}")
    return Response(
        {
            "message": "Validation failed", 
            "errors": serializer.errors
        },
        status=status.HTTP_400_BAD_REQUEST
    )