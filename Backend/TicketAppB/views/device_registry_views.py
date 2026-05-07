"""
ETM Device Registry Views
=========================
Production uploads an Excel of serial numbers → Stock.
Superadmin bulk-assigns to dealer (DealerPool) or directly to company (Allocated).
Dealer assigns from their pool to a client company (Allocated).

  POST  /etm-devices/upload              — Excel upload of serial numbers (superadmin)
  GET   /etm-devices                     — List devices (role-scoped)
  GET   /etm-devices/summary             — Count breakdown by status (role-scoped)
  POST  /etm-devices/bulk-assign-dealer  — Assign serial numbers to dealer pool (superadmin)
  POST  /etm-devices/bulk-assign-company — Assign serial numbers directly to company (superadmin)
  POST  /etm-devices/<id>/allocate       — Dealer allocates one pool device to a client company
  POST  /etm-devices/<id>/deactivate     — Mark device Inactive (superadmin)
"""

import io
import logging
import openpyxl

from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import ETMDevice, Company, Dealer, DealerCustomerMapping
from ..serializers import ETMDeviceSerializer
from .auth_views import get_user_from_cookie
from .utils import (
    _is_superadmin,
    _is_executive,
    _is_dealer_admin,
    _is_company_admin,
    _is_superadmin_or_executive,
)

logger = logging.getLogger(__name__)


# ── Scope helper ──────────────────────────────────────────────────────────────

def _device_qs_for_user(user):
    qs = ETMDevice.objects.select_related('company', 'dealer', 'created_by')

    if _is_superadmin(user):
        return qs

    if user.role == 'production':
        # Production users see only the devices they uploaded
        return qs.filter(created_by=user)

    if _is_executive(user):
        from ..models import ExecutiveCompanyMapping
        company_ids = ExecutiveCompanyMapping.objects.filter(
            executive_user_id=user.id, is_active=True
        ).values_list('company_id', flat=True)
        return qs.filter(company_id__in=company_ids)

    if _is_dealer_admin(user):
        if not user.dealer_id:
            return qs.none()
        return qs.filter(dealer_id=user.dealer_id)

    if _is_company_admin(user):
        if not user.company_id:
            return qs.none()
        return qs.filter(
            company_id=user.company_id,
            allocation_status=ETMDevice.AllocationStatus.ALLOCATED,
        )

    return qs.none()


# ── Views ─────────────────────────────────────────────────────────────────────

class DeviceUploadView(APIView):
    """
    POST /etm-devices/upload
    Accepts .xlsx with header row containing 'serial_number'.
    Creates Stock records; skips duplicates. Superadmin only.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        if not (_is_superadmin(user) or user.role == 'production'):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        excel_file = request.FILES.get('file')
        if not excel_file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        if not excel_file.name.lower().endswith('.xlsx'):
            return Response({'error': 'Only .xlsx files are accepted'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(io.BytesIO(excel_file.read()), data_only=True)
        except Exception as e:
            return Response({'error': f'Cannot read file: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return Response({'error': 'File is empty'}, status=status.HTTP_400_BAD_REQUEST)

        headers = [str(h or '').strip().lower() for h in rows[0]]
        if 'serial_number' not in headers:
            return Response({'error': 'Column "serial_number" not found in header row'}, status=status.HTTP_400_BAD_REQUEST)
        col_idx = headers.index('serial_number')

        serials = []
        for row in rows[1:]:
            val = row[col_idx] if col_idx < len(row) else None
            if val is not None and str(val).strip():
                serials.append(str(val).strip())

        if not serials:
            return Response({'error': 'No serial numbers found in file'}, status=status.HTTP_400_BAD_REQUEST)

        # Deduplicate within the file preserving order
        serials = list(dict.fromkeys(serials))

        existing = set(
            ETMDevice.objects.filter(serial_number__in=serials).values_list('serial_number', flat=True)
        )
        new_serials = [s for s in serials if s not in existing]

        ETMDevice.objects.bulk_create([
            ETMDevice(
                serial_number=s,
                device_type=ETMDevice.DeviceType.ETM,
                allocation_status=ETMDevice.AllocationStatus.STOCK,
                created_by=user,
            )
            for s in new_serials
        ])

        logger.info(f"Device upload by {user}: {len(new_serials)} created, {len(existing)} skipped")
        return Response({
            'message': f'{len(new_serials)} device(s) added to stock.',
            'created': len(new_serials),
            'skipped': len(existing),
            'skipped_serials': sorted(existing),
        }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def list_devices(request):
    """
    List devices scoped to the requesting user's role.
    Query params: ?status=Stock|DealerPool|Allocated|Inactive  ?dealer=<id>  ?company=<id>
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    qs = _device_qs_for_user(user)

    filter_status = request.query_params.get('status')
    if filter_status:
        qs = qs.filter(allocation_status=filter_status)

    filter_company = request.query_params.get('company')
    if filter_company:
        qs = qs.filter(company_id=filter_company)

    filter_dealer = request.query_params.get('dealer')
    if filter_dealer and _is_superadmin_or_executive(user):
        qs = qs.filter(dealer_id=filter_dealer)

    qs = qs.order_by('-created_at')
    return Response({'message': 'Success', 'data': ETMDeviceSerializer(qs, many=True).data}, status=status.HTTP_200_OK)


@api_view(['GET'])
def device_summary(request):
    """Count breakdown by allocation_status, scoped to the user."""
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    qs = _device_qs_for_user(user)
    by_status = {s: 0 for s in ETMDevice.AllocationStatus.values}
    for row in qs.values('allocation_status').annotate(n=Count('id')):
        by_status[row['allocation_status']] = row['n']

    by_dealer = []
    if _is_superadmin_or_executive(user):
        for row in (
            qs.filter(dealer__isnull=False)
            .values('dealer__id', 'dealer__dealer_name')
            .annotate(total=Count('id'))
            .order_by('-total')
        ):
            by_dealer.append({
                'dealer_id':   row['dealer__id'],
                'dealer_name': row['dealer__dealer_name'],
                'total':       row['total'],
            })

    return Response({
        'message': 'Success',
        'data': {'total': qs.count(), 'by_status': by_status, 'by_dealer': by_dealer},
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def bulk_assign_dealer(request):
    """
    Assign Stock serial numbers to a dealer pool.
    Body: { serial_numbers: [...], dealer_id: <int> }
    Superadmin only.
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Superadmin only'}, status=status.HTTP_403_FORBIDDEN)

    serial_numbers = request.data.get('serial_numbers', [])
    dealer_id = request.data.get('dealer_id')

    if not serial_numbers or not isinstance(serial_numbers, list):
        return Response({'error': 'serial_numbers must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)
    if not dealer_id:
        return Response({'error': 'dealer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        dealer = Dealer.objects.get(pk=dealer_id, is_active=True)
    except Dealer.DoesNotExist:
        return Response({'error': 'Dealer not found'}, status=status.HTTP_404_NOT_FOUND)

    updated = ETMDevice.objects.filter(
        serial_number__in=serial_numbers,
        allocation_status=ETMDevice.AllocationStatus.STOCK,
    ).update(dealer=dealer, allocation_status=ETMDevice.AllocationStatus.DEALER_POOL)

    return Response({
        'message': f'{updated} device(s) moved to dealer pool.',
        'assigned': updated,
        'skipped': len(serial_numbers) - updated,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def bulk_assign_company(request):
    """
    Directly assign Stock serial numbers to a company.
    Body: { serial_numbers: [...], company_id: <int> }
    Superadmin only.
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Superadmin only'}, status=status.HTTP_403_FORBIDDEN)

    serial_numbers = request.data.get('serial_numbers', [])
    company_id = request.data.get('company_id')

    if not serial_numbers or not isinstance(serial_numbers, list):
        return Response({'error': 'serial_numbers must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)
    if not company_id:
        return Response({'error': 'company_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        company = Company.objects.get(pk=company_id)
    except Company.DoesNotExist:
        return Response({'error': 'Company not found'}, status=status.HTTP_404_NOT_FOUND)

    dealer_mapping = DealerCustomerMapping.objects.filter(company=company, is_active=True).first()
    dealer = dealer_mapping.dealer if dealer_mapping else None

    updated = ETMDevice.objects.filter(
        serial_number__in=serial_numbers,
        allocation_status=ETMDevice.AllocationStatus.STOCK,
    ).update(
        company=company,
        dealer=dealer,
        allocation_status=ETMDevice.AllocationStatus.ALLOCATED,
    )

    return Response({
        'message': f'{updated} device(s) allocated to company.',
        'assigned': updated,
        'skipped': len(serial_numbers) - updated,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def allocate_to_company(request, device_id):
    """
    Dealer assigns one of their DealerPool devices to a client company.
    Body: { company_id: <int> }
    Dealer admin only — company must be under their dealer.
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_dealer_admin(user):
        return Response({'error': 'Dealer admin only'}, status=status.HTTP_403_FORBIDDEN)
    if not user.dealer_id:
        return Response({'error': 'No dealer linked to your account'}, status=status.HTTP_403_FORBIDDEN)

    company_id = request.data.get('company_id')
    if not company_id:
        return Response({'error': 'company_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        device = ETMDevice.objects.get(
            pk=device_id,
            dealer_id=user.dealer_id,
            allocation_status=ETMDevice.AllocationStatus.DEALER_POOL,
        )
    except ETMDevice.DoesNotExist:
        return Response({'error': 'Device not found in your pool'}, status=status.HTTP_404_NOT_FOUND)

    if not DealerCustomerMapping.objects.filter(
        dealer_id=user.dealer_id, company_id=company_id, is_active=True
    ).exists():
        return Response({'error': 'Company is not under your dealer'}, status=status.HTTP_403_FORBIDDEN)

    device.company_id = company_id
    device.allocation_status = ETMDevice.AllocationStatus.ALLOCATED
    device.save(update_fields=['company_id', 'allocation_status', 'updated_at'])

    return Response({'message': 'Device allocated to company', 'data': ETMDeviceSerializer(device).data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def deactivate_device(request, device_id):
    """Mark a device Inactive. Superadmin only."""
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not _is_superadmin(user):
        return Response({'error': 'Superadmin only'}, status=status.HTTP_403_FORBIDDEN)

    try:
        device = ETMDevice.objects.get(pk=device_id)
    except ETMDevice.DoesNotExist:
        return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)

    device.allocation_status = ETMDevice.AllocationStatus.INACTIVE
    device.save(update_fields=['allocation_status', 'updated_at'])

    return Response({'message': 'Device deactivated', 'data': ETMDeviceSerializer(device).data}, status=status.HTTP_200_OK)
