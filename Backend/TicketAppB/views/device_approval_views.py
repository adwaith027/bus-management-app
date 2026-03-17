from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import UserDeviceMapping
from ..serializers import UserDeviceMappingSerializer
from .auth_views import get_user_from_cookie
from .utils import _is_superadmin


@api_view(["GET"])
def get_device_approvals(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {"error_code": "AUTH_REQUIRED", "error": "Authentication required"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    if not _is_superadmin(user):
        return Response(
            {"error_code": "FORBIDDEN", "error": "Unauthorized"},
            status=status.HTTP_403_FORBIDDEN,
        )

    approved = (
        UserDeviceMapping.objects.filter(status=UserDeviceMapping.DeviceStatus.APPROVED)
        .select_related("user", "user__company", "approved_by")
        .order_by("-updated_at")
    )
    pending = (
        UserDeviceMapping.objects.filter(
            status__in=[
                UserDeviceMapping.DeviceStatus.PENDING,
                UserDeviceMapping.DeviceStatus.INACTIVE,
            ]
        )
        .select_related("user", "user__company", "approved_by")
        .order_by("-updated_at")
    )

    return Response(
        {
            "message": "Success",
            "data": {
                "approved": UserDeviceMappingSerializer(approved, many=True).data,
                "pending": UserDeviceMappingSerializer(pending, many=True).data,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
def approve_device(request, mapping_id):
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {"error_code": "AUTH_REQUIRED", "error": "Authentication required"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    if not _is_superadmin(user):
        return Response(
            {"error_code": "FORBIDDEN", "error": "Unauthorized"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        mapping = UserDeviceMapping.objects.select_related("user").get(pk=mapping_id)
    except UserDeviceMapping.DoesNotExist:
        return Response(
            {"error_code": "NOT_FOUND", "error": "Request not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    mapping.status = UserDeviceMapping.DeviceStatus.APPROVED
    mapping.approved_at = timezone.now()
    mapping.approved_by = user
    mapping.save(update_fields=["status", "approved_at", "approved_by", "updated_at"])

    return Response({"message": "Device approved"}, status=status.HTTP_200_OK)


@api_view(["POST"])
def revoke_device(request, mapping_id):
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {"error_code": "AUTH_REQUIRED", "error": "Authentication required"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    if not _is_superadmin(user):
        return Response(
            {"error_code": "FORBIDDEN", "error": "Unauthorized"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        mapping = UserDeviceMapping.objects.select_related("user").get(pk=mapping_id)
    except UserDeviceMapping.DoesNotExist:
        return Response(
            {"error_code": "NOT_FOUND", "error": "Request not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    mapping.status = UserDeviceMapping.DeviceStatus.INACTIVE
    mapping.is_active = False
    mapping.approved_by = user
    mapping.save(update_fields=["status", "is_active", "approved_by", "updated_at"])

    return Response({"message": "Device revoked"}, status=status.HTTP_200_OK)