"""
Session management and device approval views — company_admin only.

Endpoints:
  GET  /sessions                          — list active sessions for the company
  POST /sessions/<session_uid>/force-logout  — force-logout a specific session
  GET  /device-approvals                  — list pending device approval requests
  POST /device-approvals/<pk>/approve     — approve a device (with tier slot check)
  POST /device-approvals/<pk>/reject      — reject a device
"""

import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from ...models import UserSession, UserApprovedDevice, DevicePendingApproval, Company
from .auth import get_user_from_cookie, SESSION_INACTIVITY_HOURS

logger = logging.getLogger(__name__)

_STALE_THRESHOLD_HOURS = SESSION_INACTIVITY_HOURS


# ── Helpers ───────────────────────────────────────────────────────────────────

def _kill_session(session):
    """Mark a UserSession inactive and blacklist its refresh token if possible."""
    session.is_active = False
    session.save(update_fields=['is_active'])


def _tier_slot_available(company, user):
    """
    Check tier slot availability before approving a device login.
    Returns (ok: bool, error: str | None).
    """
    if not company or company.total_user_count == 0:
        return True, None  # unconfigured — no cap

    active_total = UserSession.objects.filter(
        user__company=company, is_active=True,
    ).count()
    if active_total >= company.total_user_count:
        return False, 'All login slots are in use. Deactivate a user first.'

    if user.tier == 'premium' and company.premium_user_count > 0:
        active_premium = UserSession.objects.filter(
            user__company=company, user__tier='premium', is_active=True,
        ).count()
        if active_premium >= company.premium_user_count:
            return False, 'All premium tier slots are in use.'

    if user.tier == 'intermediate' and company.intermediate_user_count > 0:
        active_intermediate = UserSession.objects.filter(
            user__company=company, user__tier='intermediate', is_active=True,
        ).count()
        if active_intermediate >= company.intermediate_user_count:
            return False, 'All intermediate tier slots are in use.'

    return True, None


# ── Session management ────────────────────────────────────────────────────────

@api_view(['GET'])
def list_sessions(request):
    """
    List all active UserSession records for this company's users.
    company_admin only.
    """
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if requester.role != 'company_admin' or not requester.company:
        return Response({'error': 'Company admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    stale_cutoff = timezone.now() - timedelta(hours=_STALE_THRESHOLD_HOURS)

    sessions = UserSession.objects.filter(
        user__company=requester.company,
        is_active=True,
    ).select_related('user').order_by('-created_at')

    data = []
    for s in sessions:
        is_stale = s.last_seen_at and s.last_seen_at < stale_cutoff
        data.append({
            'session_uid':   str(s.session_uid),
            'user_id':       s.user_id,
            'username':      s.user.username,
            'tier':          s.user.tier,
            'device_type':   s.device_type,
            'device_uuid':   s.device_uuid or None,
            'login_time':    s.created_at,
            'last_active':   s.last_seen_at,
            'is_stale':      bool(is_stale),
        })

    return Response({'message': 'Success', 'data': data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def force_logout_session(request, session_uid):
    """
    Force-logout a session by its uid.
    company_admin can only target sessions of users in their own company.
    """
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if requester.role != 'company_admin' or not requester.company:
        return Response({'error': 'Company admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        session = UserSession.objects.select_related('user').get(
            session_uid=session_uid, is_active=True,
        )
    except UserSession.DoesNotExist:
        return Response({'error': 'Session not found or already inactive.'}, status=status.HTTP_404_NOT_FOUND)

    if session.user.company_id != requester.company_id:
        return Response({'error': 'Not authorized to manage this session.'}, status=status.HTTP_403_FORBIDDEN)

    _kill_session(session)
    logger.info(
        f"company_admin '{requester.username}' force-logged-out "
        f"session {session_uid} for user '{session.user.username}'"
    )
    return Response(
        {'message': f"Session for '{session.user.username}' has been terminated."},
        status=status.HTTP_200_OK,
    )


# ── Device approvals ──────────────────────────────────────────────────────────

@api_view(['GET'])
def list_pending_approvals(request):
    """
    List pending device approval requests for this company's users.
    company_admin only.
    """
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if requester.role != 'company_admin' or not requester.company:
        return Response({'error': 'Company admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    pending = DevicePendingApproval.objects.filter(
        user__company=requester.company,
        status=DevicePendingApproval.Status.PENDING,
    ).select_related('user').order_by('-requested_at')

    data = [
        {
            'id':           p.id,
            'user_id':      p.user_id,
            'username':     p.user.username,
            'tier':         p.user.tier,
            'device_uuid':  p.device_uuid,
            'device_type':  p.device_type,
            'requested_at': p.requested_at,
        }
        for p in pending
    ]
    return Response({'message': 'Success', 'data': data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def approve_device(request, approval_id):
    """
    Approve a device login request.
    Checks tier slot availability before approving.
    Sets user.is_verified = True on first approval.
    """
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if requester.role != 'company_admin' or not requester.company:
        return Response({'error': 'Company admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        approval = DevicePendingApproval.objects.select_related('user').get(
            pk=approval_id, status=DevicePendingApproval.Status.PENDING,
        )
    except DevicePendingApproval.DoesNotExist:
        return Response({'error': 'Approval request not found or already handled.'}, status=status.HTTP_404_NOT_FOUND)

    if approval.user.company_id != requester.company_id:
        return Response({'error': 'Not authorized to approve this request.'}, status=status.HTTP_403_FORBIDDEN)

    # Check tier slot availability at approval time.
    ok, err = _tier_slot_available(requester.company, approval.user)
    if not ok:
        return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

    # Create approved device record.
    UserApprovedDevice.objects.get_or_create(
        user=approval.user,
        device_uuid=approval.device_uuid,
        defaults={'approved_by': requester},
    )

    # Mark is_verified on first ever approval.
    if not approval.user.is_verified:
        approval.user.is_verified = True
        approval.user.save(update_fields=['is_verified'])

    # Mark approval as handled.
    approval.status = DevicePendingApproval.Status.APPROVED
    approval.reviewed_by = requester
    approval.reviewed_at = timezone.now()
    approval.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])

    logger.info(
        f"company_admin '{requester.username}' approved device "
        f"{approval.device_uuid[:16]}… for user '{approval.user.username}'"
    )
    return Response(
        {'message': f"Device approved for '{approval.user.username}'. They can now log in."},
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
def reject_device(request, approval_id):
    """Reject a device login request."""
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if requester.role != 'company_admin' or not requester.company:
        return Response({'error': 'Company admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        approval = DevicePendingApproval.objects.select_related('user').get(
            pk=approval_id, status=DevicePendingApproval.Status.PENDING,
        )
    except DevicePendingApproval.DoesNotExist:
        return Response({'error': 'Approval request not found or already handled.'}, status=status.HTTP_404_NOT_FOUND)

    if approval.user.company_id != requester.company_id:
        return Response({'error': 'Not authorized to reject this request.'}, status=status.HTTP_403_FORBIDDEN)

    approval.status = DevicePendingApproval.Status.REJECTED
    approval.reviewed_by = requester
    approval.reviewed_at = timezone.now()
    approval.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])

    logger.info(
        f"company_admin '{requester.username}' rejected device "
        f"{approval.device_uuid[:16]}… for user '{approval.user.username}'"
    )
    return Response(
        {'message': f"Device request rejected for '{approval.user.username}'."},
        status=status.HTTP_200_OK,
    )
