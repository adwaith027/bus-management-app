"""
Auth views
==========
Token delivery:
  All clients (web + APK) — access_token + refresh_token + session_uid
  delivered as HttpOnly cookies. APK team handles cookie storage in their
  HTTP client (cookie_jar / dio).

  APK is identified by `device_type` field in the login request body.
  Bearer header path has been removed.

Session enforcement:
  - One active UserSession per user at a time.
  - New login blocked if an existing active session is found (not stale).
  - Stale sessions (last_seen_at > 24h ago) are auto-expired before the check.
  - Superadmin is exempt from all session limits.
  - company_user logins also check company-level concurrent session caps.
  - APK logins for company_user require device UUID approval by company_admin.
"""

import uuid
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from django.conf import settings
from django.core.cache import cache

from ...models import Company, UserSession, AuditLog, UserApprovedDevice, DevicePendingApproval
from .audit_logs import log_action

logger = logging.getLogger(__name__)
_token_generator = PasswordResetTokenGenerator()


User = get_user_model()

# Sessions inactive for longer than this are considered stale and auto-expired
# at login time before the single-session check runs.
SESSION_INACTIVITY_HOURS = 24


# ── Helpers ───────────────────────────────────────────────────────────────────

# Source - https://stackoverflow.com/a/5976065
# Posted by Sævar
# Retrieved 2026-05-13, License - CC BY-SA 3.0
def _get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[-1].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def _is_apk_request(request):
    """
    Returns True if the request originates from the APK (Flutter app).
    Detection: device_type field in request body ('android' or 'ios').
    APK uses the same cookie-based auth as web.
    """
    if hasattr(request, 'data') and isinstance(request.data, dict):
        hint = str(request.data.get('device_type', '')).lower()
        if hint in ('android', 'ios'):
            return True
    return False


def _detect_device_type(request):
    """Best-effort device type from request body hint or User-Agent."""
    if hasattr(request, 'data') and isinstance(request.data, dict):
        hint = str(request.data.get('device_type', '')).lower()
        mapping = {
            'android':     UserSession.DeviceType.ANDROID,
            'ios':         UserSession.DeviceType.IOS,
            'web_desktop': UserSession.DeviceType.WEB_DESKTOP,
            'web_mobile':  UserSession.DeviceType.WEB_MOBILE,
        }
        if hint in mapping:
            return mapping[hint]

    ua = request.META.get('HTTP_USER_AGENT', '').lower()
    if 'android' in ua:
        return UserSession.DeviceType.ANDROID
    if 'iphone' in ua or 'ipad' in ua:
        return UserSession.DeviceType.IOS
    if 'mobile' in ua:
        return UserSession.DeviceType.WEB_MOBILE
    if _is_apk_request(request):
        return UserSession.DeviceType.ANDROID   # fallback for APK
    return UserSession.DeviceType.WEB_DESKTOP


# ── Token / Cookie helpers ────────────────────────────────────────────────────

def _make_tokens(user, session_uid: str):
    """
    Create a JWT refresh + access pair with session_uid embedded as a claim.
    Both tokens carry the session_uid so any endpoint can read it from either.
    """
    refresh = RefreshToken.for_user(user)
    session_uid_str = str(session_uid)
    refresh['session_uid'] = session_uid_str
    refresh.access_token['session_uid'] = session_uid_str
    return refresh, str(refresh.access_token), str(refresh)


def _user_payload(user, company):
    """Shared user dict returned in all login responses."""
    valid_till = None
    if company and company.product_to_date:
        valid_till = company.product_to_date.strftime('%d-%m-%Y')
    return {
        'id':             user.id,
        'username':       user.username,
        'email':          user.email,
        'role':           user.role,
        'tier':           user.tier,
        'state':          user.state,
        'is_verified':    user.is_verified,
        'company_name':   company.company_name   if company else None,
        'company_id':     company.company_id     if company else None,
        'valid_till':     valid_till,
        'license_status': company.authentication_status if company else None,
    }


def _build_token_response(user, company, session_uid):
    """Issue tokens as HttpOnly cookies and store refresh jti for force-logout blacklisting."""
    refresh, access_token, refresh_token = _make_tokens(user, session_uid)
    UserSession.objects.filter(session_uid=session_uid).update(refresh_jti=str(refresh['jti']))
    response = Response({
        'message': 'Login Successful',
        'user': _user_payload(user, company),
    })
    cookie_kwargs = dict(httponly=True, secure=not settings.DEBUG, samesite='Lax', path='/')
    response.set_cookie('access_token',  access_token,  max_age=900,    **cookie_kwargs)
    response.set_cookie('refresh_token', refresh_token, max_age=604800, **cookie_kwargs)
    response.set_cookie('session_uid',   session_uid,   max_age=604800, **cookie_kwargs)
    return response


def _build_logout_response(message):
    """Web logout: clear all auth cookies."""
    response = Response({'message': message})
    for cookie in ('access_token', 'refresh_token', 'session_uid'):
        response.delete_cookie(cookie, path='/')
    return response


# ── Auth utilities ────────────────────────────────────────────────────────────

def get_user_from_cookie(request):
    """
    Web path only — extract user from access_token cookie.
    Kept for all web views; APK views should use get_user_from_request().
    """
    access_token = request.COOKIES.get('access_token')
    if not access_token:
        return None
    try:
        token = AccessToken(access_token)
        session_uid = token.get('session_uid')
        if session_uid and cache.get(f'busmgmt:revoked:{session_uid}'):
            return None
        return User.objects.get(id=token['user_id'])
    except (TokenError, User.DoesNotExist):
        return None


def get_user_from_request(request):
    """
    Cookie-based auth — works for both web and APK (APK uses cookies).
    Kept as an alias for get_user_from_cookie for call-site compatibility.
    """
    return get_user_from_cookie(request)


def _get_session_uid_from_request(request):
    """Extract the session_uid claim from the access_token cookie."""
    token_str = request.COOKIES.get('access_token')
    if not token_str:
        return None
    try:
        token = AccessToken(token_str)
        return token.get('session_uid')
    except TokenError:
        return None


# ── Session helpers ───────────────────────────────────────────────────────────

def _expire_stale_sessions(user):
    """
    Kill all sessions for this user that have been inactive for >24 hours.
    Called at login time before the single-session check.
    """
    cutoff = timezone.now() - timedelta(hours=SESSION_INACTIVITY_HOURS)
    UserSession.objects.filter(
        user=user, is_active=True, last_seen_at__lt=cutoff,
    ).update(is_active=False)
    UserSession.objects.filter(
        user=user, is_active=True,
        last_seen_at__isnull=True, created_at__lt=cutoff,
    ).update(is_active=False)


def _enforce_single_session(user):
    """
    Block new login if a live session already exists.
    Superadmin is exempt. Stale sessions must be expired first via _expire_stale_sessions().
    Returns an error Response or None if the login may proceed.
    """
    if user.role == 'superadmin':
        return None

    if UserSession.objects.filter(user=user, is_active=True).exists():
        return Response(
            {
                'error': (
                    'Active session detected on another device. '
                    'Log out from there first, or contact an admin '
                    'if this was not you.'
                ),
                'error_code': 'ALREADY_LOGGED_IN',
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _create_session(user, request, device_uuid=None):
    """Create a new UserSession and return its session_uid (str)."""
    session = UserSession.objects.create(
        user=user,
        session_uid=uuid.uuid4(),
        device_type=_detect_device_type(request),
        user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:500],
        is_active=True,
        last_seen_at=timezone.now(),
        device_uuid=device_uuid,
    )
    return str(session.session_uid)


# ── Views ─────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def login_view(request):
    """
    Login — full check order:

      1.  Credentials valid + user is_active
      2.  Entity (company / dealer) active + license not expired
      3.  company_admin cannot log in via APK
      4.  APK + unrecognised device UUID → DEVICE_PENDING
      5.  Auto-expire stale sessions (>24h)
      6.  Active session elsewhere → block + notify
      7.  Concurrent session cap (company_user only)
      8.  Create UserSession (store device_uuid)
      9.  Issue tokens as cookies
      10. Attach login notifications
    """
    if not request.data:
        return Response({'error': 'Invalid request. No credentials provided'}, status=status.HTTP_400_BAD_REQUEST)

    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Please provide username and password'}, status=status.HTTP_400_BAD_REQUEST)

    # ── 1: Credentials + is_active ────────────────────────────────────────────
    user = authenticate(username=username, password=password)

    if not user:
        try:
            existing = User.objects.get(username=username)
            if not existing.is_active:
                return Response(
                    {'error': 'Account is inactive. Contact administrator.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except User.DoesNotExist:
            pass
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    if not user.is_active:
        return Response({'error': 'Account is inactive. Contact administrator.'}, status=status.HTTP_403_FORBIDDEN)

    # ── 2: Entity checks ──────────────────────────────────────────────────────
    company = user.company
    if company:
        if not company.is_active:
            return Response(
                {'error': 'Company account is deactivated. Contact administrator.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if company.product_to_date and timezone.now().date() > company.product_to_date:
            return Response(
                {'error': f'License expired (ID: {company.company_id}). Contact administrator.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if company.authentication_status and company.authentication_status != Company.AuthStatus.APPROVED:
            return Response(
                {'error': 'License not yet approved. Contact administrator.'},
                status=status.HTTP_403_FORBIDDEN,
            )

    dealer = user.dealer
    if dealer and not dealer.is_active:
        return Response(
            {'error': 'Dealer account is deactivated. Contact administrator.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    is_apk = _is_apk_request(request)

    # ── 3: web-only roles cannot log in via APK ──────────────────────────────
    if user.role in ('superadmin', 'company_admin') and is_apk:
        return Response(
            {'error': 'This account can only log in via the web dashboard.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # ── 4: Device approval check (APK, company_user only) ────────────────────
    device_uuid = None
    if is_apk and user.role == 'company_user':
        device_uuid = (
            request.data.get('uuid') or request.data.get('device_uuid') or ''
        ).strip() or None

        if not device_uuid:
            return Response(
                {
                    'error': 'Device identifier required for mobile login. Please update your app.',
                    'error_code': 'DEVICE_UUID_MISSING',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        approved = UserApprovedDevice.objects.filter(
            user=user, device_uuid=device_uuid, is_revoked=False
        ).exists()
        if not approved:
            DevicePendingApproval.objects.get_or_create(
                user=user,
                device_uuid=device_uuid,
                defaults={
                    'device_type': str(_detect_device_type(request)),
                    'status': DevicePendingApproval.Status.PENDING,
                },
            )
            return Response(
                {
                    'error': (
                        'Initial login on this device. '
                        'Contact your company admin for approval.'
                    ),
                    'error_code': 'DEVICE_PENDING',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

    # ── 5-8: Session check + creation (atomic — prevents concurrent-login race) ─
    # select_for_update acquires a row-level lock on this user row so that two
    # simultaneous logins for the same username are serialised: the second waits
    # at the lock until the first commits (or rolls back), then re-runs the check
    # and finds an active session already present.
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)

        # ── 5: Auto-expire stale sessions (>24h) ──────────────────────────────
        _expire_stale_sessions(user)

        # ── 6: Active session elsewhere ───────────────────────────────────────
        block = _enforce_single_session(user)
        if block:
            return block

        # ── 7: Concurrent session cap (company_user only, superadmin exempt) ──
        if user.role == 'company_user' and company:
            if company.total_user_count > 0:
                active_count = UserSession.objects.filter(
                    user__company=company, is_active=True,
                ).count()
                if active_count >= company.total_user_count:
                    return Response(
                        {'error': 'All login slots are in use. Another user must log out first.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

            if user.tier == 'premium' and company.premium_user_count > 0:
                premium_active = UserSession.objects.filter(
                    user__company=company, user__tier='premium', is_active=True,
                ).count()
                if premium_active >= company.premium_user_count:
                    return Response(
                        {'error': 'All premium tier slots are in use. Another premium user must log out first.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

            if user.tier == 'intermediate' and company.intermediate_user_count > 0:
                intermediate_active = UserSession.objects.filter(
                    user__company=company, user__tier='intermediate', is_active=True,
                ).count()
                if intermediate_active >= company.intermediate_user_count:
                    return Response(
                        {'error': 'All intermediate tier slots are in use. Another intermediate user must log out first.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

        # ── 8: Create session ──────────────────────────────────────────────────
        session_uid = _create_session(user, request, device_uuid=device_uuid)

    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])

    # ── 9: Issue tokens as cookies ────────────────────────────────────────────
    response = _build_token_response(user, company, session_uid)

    # ── 10: Login notifications ───────────────────────────────────────────────
    try:
        from .notifications import get_login_notifications
        notifications = get_login_notifications(user, company)
        if notifications:
            response.data['notifications'] = notifications
    except Exception as _exc:
        logger.warning(f"Failed to compute login notifications: {_exc}")

    log_action(
        actor=user, action=AuditLog.ActionType.LOGIN,
        target_model='CustomUser', target_id=user.pk,
        target_display=user.username,
        details={'device_type': str(_detect_device_type(request))},
        ip_address=request.META.get('REMOTE_ADDR'),
    )

    return response


@api_view(['POST'])
def logout_view(request):
    """
    Logout — mark the UserSession inactive and clear tokens.
    Both web and APK use cookie-based auth; session_uid read from access_token cookie.
    """
    logout_user = get_user_from_request(request)

    session_uid = _get_session_uid_from_request(request)
    if not session_uid:
        # Fallback: APK may pass session_uid in body
        session_uid = request.data.get('session_uid') if hasattr(request, 'data') else None

    session_obj = None
    if session_uid:
        session_obj = UserSession.objects.filter(session_uid=session_uid).first()
        UserSession.objects.filter(session_uid=session_uid).update(is_active=False)

    # Blacklist the refresh token so it cannot be used for /token/refresh after logout.
    #
    # Primary path — token string (cookie or APK body):
    #   RefreshToken(str).blacklist() is simplejwt's own method; it creates the
    #   OutstandingToken record if missing, then writes BlacklistedToken. Works
    #   even when the access token is already expired (no session_uid needed).
    #
    # Fallback path — JTI from the session record:
    #   Used when the refresh cookie/body is absent. Requires OutstandingToken to
    #   already exist (created at login time by simplejwt).
    refresh_token_str = (
        request.COOKIES.get('refresh_token')
        or (request.data.get('refresh_token') if hasattr(request, 'data') else None)
    )
    if refresh_token_str:
        try:
            RefreshToken(refresh_token_str).blacklist()
        except Exception as exc:
            logger.warning(f'Could not blacklist refresh token on logout: {exc}')
    elif session_obj and session_obj.refresh_jti:
        try:
            from rest_framework_simplejwt.token_blacklist.models import (
                OutstandingToken, BlacklistedToken,
            )
            outstanding = OutstandingToken.objects.get(jti=session_obj.refresh_jti)
            BlacklistedToken.objects.get_or_create(token=outstanding)
        except OutstandingToken.DoesNotExist:
            logger.warning(f'OutstandingToken not found for jti={session_obj.refresh_jti} on logout')
        except Exception as exc:
            logger.error(f'Failed to blacklist refresh token on logout (JTI path): {exc}')

    if logout_user:
        log_action(
            actor=logout_user, action=AuditLog.ActionType.LOGOUT,
            target_model='CustomUser', target_id=logout_user.pk,
            target_display=logout_user.username,
            ip_address=request.META.get('REMOTE_ADDR'),
        )

    return _build_logout_response('Logged out successfully')


@api_view(['POST'])
def refresh_token_view(request):
    """
    Token refresh. Reads refresh_token from cookie; issues new access_token cookie.
    Updates UserSession.last_seen_at to keep the session alive (resets 24h TTL).
    """
    refresh_token_str = request.COOKIES.get('refresh_token')
    session_uid_hint  = request.COOKIES.get('session_uid')

    if not refresh_token_str:
        return Response({'error': 'No refresh token found'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        refresh = RefreshToken(refresh_token_str)
        session_uid = refresh.get('session_uid') or session_uid_hint

        if session_uid:
            if not UserSession.objects.filter(session_uid=session_uid, is_active=True).exists():
                return Response({'error': 'Session has been terminated.'}, status=status.HTTP_401_UNAUTHORIZED)
            UserSession.objects.filter(
                session_uid=session_uid, is_active=True,
            ).update(last_seen_at=timezone.now())

        new_access_token = str(refresh.access_token)
        response = Response({'message': 'Token refreshed successfully'})
        response.set_cookie(
            key='access_token', value=new_access_token,
            httponly=True, secure=not settings.DEBUG,
            samesite='Lax', max_age=900, path='/',
        )
        return response

    except TokenError:
        return Response({'error': 'Invalid or expired refresh token'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
def verify_auth(request):
    """Auth check — works for both web (cookie) and APK (Bearer)."""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)

    company = user.company
    valid_till = None
    if company and company.product_to_date:
        valid_till = company.product_to_date.strftime('%d-%m-%Y')

    return Response({
        'authenticated': True,
        'user': {
            'id':             user.id,
            'username':       user.username,
            'email':          user.email,
            'role':           user.role,
            'tier':           user.tier,
            'is_verified':    user.is_verified,
            'company_name':   company.company_name   if company else None,
            'company_id':     company.company_id     if company else None,
            'valid_till':     valid_till,
            'license_status': company.authentication_status if company else None,
        },
    })


@api_view(['GET'])
def protected_view(request):
    """Dev test endpoint — verifies token; not exposed in production."""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response({
        'message': f'Hello {user.username}!',
        'user': {'id': user.id, 'username': user.username, 'email': user.email, 'role': user.role},
    })


# ── Self-service password reset ───────────────────────────────────────────────
#
# Flow:
#   1. POST /auth/forgot-password   { email }
#      → Always returns 200 (no email enumeration).
#      → If email found, generates a PasswordResetTokenGenerator token,
#        encodes uid in base64, and sends a link to the frontend reset page.
#
#   2. POST /auth/reset-password    { uid, token, new_password }
#      → Validates the token (auto-expires after PASSWORD_RESET_TIMEOUT,
#        default 3 days in Django). Sets the new password on success.
#
# Required settings (add to settings.py / .env):
#   EMAIL_BACKEND  — e.g. 'django.core.mail.backends.smtp.EmailBackend'
#   EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS
#   DEFAULT_FROM_EMAIL
#   FRONTEND_URL   — base URL of the React app, e.g. 'http://localhost:5173'
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def forgot_password(request):
    """
    Initiate self-service password reset.
    Accepts { email }.  Always responds with 200 to prevent email enumeration.
    """
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email, is_active=True)
    except User.DoesNotExist:
        # Silent success — don't reveal whether the email exists
        return Response({'message': 'If an account with that email exists, a reset link has been sent.'}, status=status.HTTP_200_OK)

    uid   = urlsafe_base64_encode(force_bytes(user.pk))
    token = _token_generator.make_token(user)

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    reset_link   = f'{frontend_url}/reset-password?uid={uid}&token={token}'

    subject = 'Password Reset Request'
    body = (
        f'Hello {user.username},\n\n'
        f'We received a request to reset your password.\n\n'
        f'Click the link below to set a new password (expires in 3 days):\n'
        f'{reset_link}\n\n'
        f'If you did not request a password reset, ignore this email — your password will not change.\n\n'
        f'— Bus Management App'
    )

    try:
        send_mail(
            subject,
            body,
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@busmanagement.app'),
            [user.email],
            fail_silently=False,
        )
        logger.info(f"Password reset email sent to {user.email} (user_id={user.pk})")
    except Exception as exc:
        # Log the failure but still return 200 — the token is valid and the
        # admin can manually share the link if needed.
        logger.error(f"Failed to send password reset email to {user.email}: {exc}")

    return Response({'message': 'If an account with that email exists, a reset link has been sent.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
def reset_password(request):
    """
    Complete self-service password reset.
    Accepts { uid, token, new_password }.
    """
    uid_b64      = (request.data.get('uid')          or '').strip()
    token        = (request.data.get('token')         or '').strip()
    new_password = (request.data.get('new_password')  or '').strip()

    if not uid_b64 or not token or not new_password:
        return Response({'error': 'uid, token, and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        uid  = force_str(urlsafe_base64_decode(uid_b64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({'error': 'Invalid or expired reset link.'}, status=status.HTTP_400_BAD_REQUEST)

    if not _token_generator.check_token(user, token):
        return Response({'error': 'Invalid or expired reset link.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()

    log_action(
        actor=user, action=AuditLog.ActionType.PASSWORD_RESET,
        target_model='CustomUser', target_id=user.pk,
        target_display=user.username,
        details={'self_service': True},
        ip_address=request.META.get('REMOTE_ADDR'),
    )

    # Invalidate all active sessions so the old password can no longer be used
    # (sessions hold JWTs signed before the password change).
    from ...models import UserSession as _UserSession
    _UserSession.objects.filter(user=user, is_active=True).update(is_active=False)

    logger.info(f"Password reset completed for user_id={user.pk} ({user.username})")
    return Response({'message': 'Password reset successfully. Please log in with your new password.'}, status=status.HTTP_200_OK)
