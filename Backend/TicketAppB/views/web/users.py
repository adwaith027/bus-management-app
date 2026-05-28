"""
User management views — Phase 4
================================
Permission matrix:
  superadmin    → create: executive, dealer_admin, company_admin (any direct company)
               → view / edit / toggle all non-superadmin users
  dealer_admin  → create: company_admin (their dealer's companies only)
               → view / edit company_admins under their dealer
  company_admin → create: company_user (own company only, auto-scoped)
               → view / edit / toggle company_users in own company
               → see tier capacity (remaining slots)
  nobody        → create: superadmin / production (blocked)
"""

from datetime import datetime

from django.contrib.auth import get_user_model
from django.db.models import Q as models_Q
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ...models import Company, CustomUser, AuditLog
from ...serializers.auth import UserSerializer
from .auth import get_user_from_cookie
from ..utils import _is_superadmin, _is_dealer_admin, _is_company_admin
from .audit_logs import log_action


User = get_user_model()

_VALID_TIERS = {'basic', 'intermediate', 'premium'}


# ── Slot helpers ──────────────────────────────────────────────────────────────

def _check_user_slot(company, tier):
    """
    Check capacity before creating a new user.
    Returns (ok: bool, error: str | None).
    A limit of 0 means "not configured yet" — creation is allowed.
    """
    if not company:
        return True, None

    if company.total_user_count > 0:
        current = User.objects.filter(
            company=company, is_active=True,
            role__in=('company_admin', 'company_user'),
        ).count()
        if current >= company.total_user_count:
            return False, (
                f'User limit reached ({current}/{company.total_user_count}). '
                'Upgrade your license or deactivate an existing user.'
            )

    if tier == 'intermediate' and company.intermediate_user_count > 0:
        current = User.objects.filter(
            company=company, is_active=True, tier='intermediate',
        ).count()
        if current >= company.intermediate_user_count:
            return False, f'Intermediate tier limit reached ({current}/{company.intermediate_user_count}).'

    if tier == 'premium' and company.premium_user_count > 0:
        current = User.objects.filter(
            company=company, is_active=True, tier='premium',
        ).count()
        if current >= company.premium_user_count:
            return False, f'Premium tier limit reached ({current}/{company.premium_user_count}).'

    return True, None


def _check_tier_slot_for_update(company, exclude_user_pk, new_tier):
    """
    Check tier slot capacity before changing a user's tier.
    Excludes the user being updated so they don't count against their own slot.
    Only tier-specific sub-limits matter here — total count is unchanged.
    """
    if not company:
        return True, None

    if new_tier == 'intermediate' and company.intermediate_user_count > 0:
        current = User.objects.filter(
            company=company, is_active=True, tier='intermediate',
        ).exclude(pk=exclude_user_pk).count()
        if current >= company.intermediate_user_count:
            return False, f'Intermediate tier limit reached ({current}/{company.intermediate_user_count}).'

    if new_tier == 'premium' and company.premium_user_count > 0:
        current = User.objects.filter(
            company=company, is_active=True, tier='premium',
        ).exclude(pk=exclude_user_pk).count()
        if current >= company.premium_user_count:
            return False, f'Premium tier limit reached ({current}/{company.premium_user_count}).'

    return True, None


# ── Create user ───────────────────────────────────────────────────────────────

@api_view(['POST'])
def create_user(request):
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if not request.data:
        return Response({'error': 'Invalid Input'}, status=status.HTTP_400_BAD_REQUEST)

    username       = request.data.get('username')
    email          = request.data.get('email')
    role           = request.data.get('role')
    password       = request.data.get('password')
    company_id     = request.data.get('company_id')
    requested_tier = (request.data.get('tier') or '').strip().lower()

    if not all([username, email, role, password]):
        return Response({'error': 'username, email, role, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if role in ('superadmin', 'production'):
        return Response({'error': 'Creating superadmin or production accounts is not allowed.'}, status=status.HTTP_403_FORBIDDEN)

    company_instance = None

    if _is_superadmin(requester):
        if role not in ('executive', 'company_admin', 'dealer_admin'):
            return Response({'error': 'Superadmin can only create executive, dealer_admin, or company_admin users.'}, status=status.HTTP_403_FORBIDDEN)
        if role == 'company_admin':
            if not company_id:
                return Response({'error': 'company_id is required for company_admin.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                company_instance = Company.objects.get(id=company_id)
            except Company.DoesNotExist:
                return Response({'error': 'Company not found.'}, status=status.HTTP_404_NOT_FOUND)

    elif _is_dealer_admin(requester):
        if role != 'company_admin':
            return Response({'error': 'Dealer admin can only create company_admin users.'}, status=status.HTTP_403_FORBIDDEN)
        if not company_id:
            return Response({'error': 'company_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not requester.dealer_id:
            return Response({'error': 'No dealer linked to this account.'}, status=status.HTTP_400_BAD_REQUEST)
        if not Company.objects.filter(id=company_id, dealer_id=requester.dealer_id, is_active=True).exists():
            return Response({'error': 'Company not found or not under your dealer.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            company_instance = Company.objects.get(id=company_id)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found.'}, status=status.HTTP_404_NOT_FOUND)

    elif _is_company_admin(requester):
        if role != 'company_user':
            return Response({'error': 'Company admin can only create company_user accounts.'}, status=status.HTTP_403_FORBIDDEN)
        if not requester.company:
            return Response({'error': 'No company linked to this account.'}, status=status.HTTP_400_BAD_REQUEST)
        company_instance = requester.company

    else:
        return Response({'error': 'You do not have permission to create users.'}, status=status.HTTP_403_FORBIDDEN)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    if role in ('company_admin', 'company_user'):
        tier = requested_tier if requested_tier in _VALID_TIERS else 'basic'
        ok, err = _check_user_slot(company_instance, tier)
        if not ok:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)
    else:
        tier = 'none'

    try:
        new_user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            company=company_instance,
            role=role,
            tier=tier,
            created_by=requester,
        )
        log_action(
            actor=requester, action=AuditLog.ActionType.CREATE,
            target_model='CustomUser', target_id=new_user.pk,
            target_display=new_user.username,
            details={'role': new_user.role, 'tier': new_user.tier},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({'message': 'User added successfully'}, status=status.HTTP_201_CREATED)
    except Exception:
        return Response({'message': 'User creation failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── List users ────────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_all_users(request):
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if _is_superadmin(requester):
        direct_company_ids = Company.objects.filter(client_type='direct').values_list('id', flat=True)
        users = CustomUser.objects.filter(
            models_Q(role='company_admin', company_id__in=direct_company_ids) |
            models_Q(role='executive') |
            models_Q(role='dealer_admin')
        ).order_by('id')

    elif _is_dealer_admin(requester):
        if not requester.dealer_id:
            return Response({'error': 'No dealer linked.'}, status=status.HTTP_400_BAD_REQUEST)
        dealer_company_ids = Company.objects.filter(
            dealer_id=requester.dealer_id, is_active=True,
        ).values_list('id', flat=True)
        users = CustomUser.objects.filter(
            role='company_admin', company_id__in=dealer_company_ids,
        ).order_by('id')

    elif _is_company_admin(requester):
        if not requester.company:
            return Response({'error': 'No company linked.'}, status=status.HTTP_400_BAD_REQUEST)
        users = CustomUser.objects.filter(
            role='company_user', company=requester.company,
        ).order_by('id')

    else:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    serializer = UserSerializer(users, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


# ── Update user ───────────────────────────────────────────────────────────────

@api_view(['PUT'])
def update_user(request, user_id):
    """
    Update username, email, and/or tier for a user.

    Authorization:
      superadmin   → any non-superadmin user
      dealer_admin → company_admin of their dealer's companies
      company_admin→ company_user of their own company (username/email/tier)

    Tier changes are validated against remaining tier slots.
    Role and company cannot be changed here — create a new user instead.
    """
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        target = User.objects.select_related('company', 'dealer').get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': f'User {user_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

    # ── Authorization scope ───────────────────────────────────────────────────
    if _is_superadmin(requester):
        if target.role == 'superadmin':
            return Response({'error': 'Cannot edit another superadmin.'}, status=status.HTTP_403_FORBIDDEN)

    elif _is_dealer_admin(requester):
        if not requester.dealer_id:
            return Response({'error': 'No dealer linked.'}, status=status.HTTP_400_BAD_REQUEST)
        # Can only edit company_admin users under their dealer
        if target.role != 'company_admin':
            return Response({'error': 'Dealer admin can only edit company_admin users.'}, status=status.HTTP_403_FORBIDDEN)
        if not target.company or target.company.dealer_id != requester.dealer_id:
            return Response({'error': 'User is not under your dealer.'}, status=status.HTTP_403_FORBIDDEN)

    elif _is_company_admin(requester):
        # Can only edit company_user accounts within own company
        if target.role != 'company_user':
            return Response({'error': 'Company admin can only edit company_user accounts.'}, status=status.HTTP_403_FORBIDDEN)
        if not requester.company or target.company_id != requester.company_id:
            return Response({'error': 'User is not in your company.'}, status=status.HTTP_403_FORBIDDEN)

    else:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    # ── Field extraction ──────────────────────────────────────────────────────
    new_username = (request.data.get('username') or '').strip()
    new_email    = (request.data.get('email')    or '').strip()
    new_tier     = (request.data.get('tier')     or '').strip().lower()

    if not new_username or not new_email:
        return Response({'error': 'username and email are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=new_username).exclude(pk=user_id).exists():
        return Response({'error': 'Username already taken.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=new_email).exclude(pk=user_id).exists():
        return Response({'error': 'Email already registered to another user.'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Tier change (company-level users only) ────────────────────────────────
    old_tier = target.tier
    tier_changed = False
    if new_tier and target.role in ('company_admin', 'company_user'):
        if new_tier not in _VALID_TIERS:
            return Response({'error': f'Invalid tier. Choose from: {", ".join(_VALID_TIERS)}'}, status=status.HTTP_400_BAD_REQUEST)
        if new_tier != target.tier:
            ok, err = _check_tier_slot_for_update(target.company, user_id, new_tier)
            if not ok:
                return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)
            target.tier = new_tier
            tier_changed = True

    # ── Save ──────────────────────────────────────────────────────────────────
    target.username = new_username
    target.email    = new_email
    try:
        target.save(update_fields=['username', 'email', 'tier'])
    except Exception:
        return Response({'error': 'Update failed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    log_action(
        actor=requester, action=AuditLog.ActionType.UPDATE,
        target_model='CustomUser', target_id=target.pk,
        target_display=target.username,
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    if tier_changed:
        log_action(
            actor=requester, action=AuditLog.ActionType.TIER_CHANGE,
            target_model='CustomUser', target_id=target.pk,
            target_display=target.username,
            details={'old_tier': old_tier, 'new_tier': target.tier},
            ip_address=request.META.get('REMOTE_ADDR'),
        )

    return Response({
        'status': 'success',
        'message': 'User updated successfully',
        'data': UserSerializer(target).data,
    }, status=status.HTTP_200_OK)


# ── Activate / Deactivate (soft-delete) ───────────────────────────────────────

@api_view(['POST'])
def toggle_user_active(request, user_id):
    """
    Toggle a user's is_active flag.
      active   → False  : soft-delete; frees the tier slot; kills active session.
      inactive → True   : reactivate; checks slot capacity before allowing.

    Authorization mirrors update_user.
    """
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        target = User.objects.select_related('company').get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': f'User {user_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

    # ── Authorization ─────────────────────────────────────────────────────────
    if _is_superadmin(requester):
        if target.role == 'superadmin':
            return Response({'error': 'Cannot deactivate another superadmin.'}, status=status.HTTP_403_FORBIDDEN)

    elif _is_dealer_admin(requester):
        if target.role != 'company_admin' or not target.company or target.company.dealer_id != requester.dealer_id:
            return Response({'error': 'Not authorized to toggle this user.'}, status=status.HTTP_403_FORBIDDEN)

    elif _is_company_admin(requester):
        if target.role != 'company_user' or target.company_id != requester.company_id:
            return Response({'error': 'Not authorized to toggle this user.'}, status=status.HTTP_403_FORBIDDEN)

    else:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    # ── Prevent self-deactivation ─────────────────────────────────────────────
    if target.pk == requester.pk:
        return Response({'error': 'You cannot deactivate your own account.'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Reactivation slot check ───────────────────────────────────────────────
    if not target.is_active:
        # User is currently inactive — reactivating means adding them back to the slot count
        ok, err = _check_user_slot(target.company, target.tier)
        if not ok:
            return Response({'error': f'Cannot reactivate: {err}'}, status=status.HTTP_403_FORBIDDEN)

    was_active = target.is_active
    new_state = not target.is_active
    target.is_active = new_state
    target.save(update_fields=['is_active'])

    # Kill the active session when deactivating so the token is immediately invalid
    if not new_state:
        from ...models import UserSession
        killed = UserSession.objects.filter(user=target, is_active=True).update(is_active=False)
        if killed:
            import logging
            logging.getLogger(__name__).info(
                f"Killed {killed} session(s) for deactivated user '{target.username}'."
            )

    toggle_action = AuditLog.ActionType.DEACTIVATE if was_active else AuditLog.ActionType.ACTIVATE
    log_action(
        actor=requester, action=toggle_action,
        target_model='CustomUser', target_id=target.pk,
        target_display=target.username,
        ip_address=request.META.get('REMOTE_ADDR'),
    )

    action = 'reactivated' if new_state else 'deactivated'
    return Response({
        'message': f'User {action} successfully.',
        'data': {'id': target.id, 'username': target.username, 'is_active': target.is_active},
    }, status=status.HTTP_200_OK)


# ── Tier / slot capacity ──────────────────────────────────────────────────────

@api_view(['GET'])
def user_capacity(request):
    """
    Return tier slot usage and remaining capacity for the requester's company.
    Intended for the company admin dashboard ("Add user" button state).

    company_admin: own company.
    superadmin:    ?company_id=<id> query param.
    dealer_admin:  ?company_id=<id> restricted to their dealer.
    """
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if _is_company_admin(requester):
        company = requester.company
        if not company:
            return Response({'error': 'No company linked.'}, status=status.HTTP_400_BAD_REQUEST)

    elif _is_superadmin(requester):
        cid = request.query_params.get('company_id')
        if not cid:
            return Response({'error': 'Pass ?company_id=<id>'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            company = Company.objects.get(pk=cid)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found.'}, status=status.HTTP_404_NOT_FOUND)

    elif _is_dealer_admin(requester):
        cid = request.query_params.get('company_id')
        if not cid:
            return Response({'error': 'Pass ?company_id=<id>'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            company = Company.objects.get(pk=cid, dealer_id=requester.dealer_id, is_active=True)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found under your dealer.'}, status=status.HTTP_404_NOT_FOUND)

    else:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    # Count active users per tier
    from django.db.models import Count, Case, When, IntegerField, Value
    stats = User.objects.filter(
        company=company, is_active=True,
        role__in=('company_admin', 'company_user'),
    ).aggregate(
        total       = Count('id'),
        basic_count = Count(Case(When(tier='basic',        then=Value(1)), output_field=IntegerField())),
        inter_count = Count(Case(When(tier='intermediate', then=Value(1)), output_field=IntegerField())),
        prem_count  = Count(Case(When(tier='premium',      then=Value(1)), output_field=IntegerField())),
    )

    def _remaining(limit, used):
        if limit <= 0:
            return None   # null = no limit configured
        return max(0, limit - used)

    return Response({
        'message': 'Success',
        'data': {
            'company_id':   company.id,
            'company_name': company.company_name,
            'total': {
                'limit':     company.total_user_count or None,
                'used':      stats['total'],
                'remaining': _remaining(company.total_user_count, stats['total']),
            },
            'tiers': {
                'basic': {
                    'limit':     None,   # basic has no sub-limit; bounded by total
                    'used':      stats['basic_count'],
                },
                'intermediate': {
                    'limit':     company.intermediate_user_count or None,
                    'used':      stats['inter_count'],
                    'remaining': _remaining(company.intermediate_user_count, stats['inter_count']),
                },
                'premium': {
                    'limit':     company.premium_user_count or None,
                    'used':      stats['prem_count'],
                    'remaining': _remaining(company.premium_user_count, stats['prem_count']),
                },
            },
        },
    }, status=status.HTTP_200_OK)


# ── Admin password reset ──────────────────────────────────────────────────────

@api_view(['POST'])
def change_user_password(request, user_id):
    """Superadmin directly sets a new password for any user (UI button)."""
    requester = get_user_from_cookie(request)
    if not requester:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if requester.role != 'superadmin':
        return Response({'error': 'Only superadmin can reset another user\'s password.'}, status=status.HTTP_403_FORBIDDEN)

    new_password = (request.data.get('new_password') or '').strip()
    if not new_password:
        return Response({'error': 'new_password is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': f'User {user_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        target.set_password(new_password)
        target.save()
        log_action(
            actor=requester, action=AuditLog.ActionType.PASSWORD_RESET,
            target_model='CustomUser', target_id=target.pk,
            target_display=target.username,
            details={'changed_by': requester.username},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({
            'status': 'success',
            'message': 'Password changed successfully.',
            'data': {
                'user_id':             target.id,
                'username':            target.username,
                'password_changed_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            },
        }, status=status.HTTP_200_OK)
    except Exception:
        return Response({'error': 'Password update failed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
