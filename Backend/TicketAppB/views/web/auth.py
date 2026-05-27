"""
Auth views — Phase 2
====================
Token delivery:
  Web (cookie path) — access_token + refresh_token set as HttpOnly cookies.
                      session_uid stored as a separate HttpOnly cookie.
  APK (Bearer path) — access_token + refresh_token + session_uid returned in
                      response body. APK stores them in SharedPreferences and
                      sends Authorization: Bearer <access_token> on every request.

Session enforcement:
  - One active UserSession per user.
  - New login is blocked if an existing session's last_seen_at is within
    SESSION_INACTIVITY_DAYS, unless the requester is superadmin.
  - On new login all stale (beyond TTL) sessions are killed first.
  - logout marks the session inactive via session_uid in JWT claim.
  - token refresh updates last_seen_at to keep the session alive.
"""

import uuid
import logging
from datetime import date, timedelta

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

from ...models import Company, UserSession

logger = logging.getLogger(__name__)
_token_generator = PasswordResetTokenGenerator()


User = get_user_model()

# A session whose last_seen_at is older than this is considered stale.
# Must match or exceed the JWT refresh-token TTL so an active session
# can always be refreshed within the window.
SESSION_INACTIVITY_DAYS = 7


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
    Detection order:
      1. Explicit body hint: device_type in ('android', 'ios')
      2. Authorization: Bearer header present (no access_token cookie)
    Web requests always carry the access_token cookie; APK requests carry a
    Bearer header because cookies are inconvenient on mobile.
    """
    device_type_hint = ''
    if hasattr(request, 'data') and isinstance(request.data, dict):
        device_type_hint = str(request.data.get('device_type', '')).lower()
    if device_type_hint in ('android', 'ios'):
        return True

    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer ') and not request.COOKIES.get('access_token'):
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
        'is_verified':    user.is_verified,
        'company_name':   company.company_name   if company else None,
        'company_id':     company.company_id     if company else None,
        'valid_till':     valid_till,
        'license_status': company.authentication_status if company else None,
    }


def _build_web_token_response(user, company, access_token, refresh_token, session_uid):
    """Web path: tokens + session_uid delivered as HttpOnly cookies."""
    response = Response({
        'message': 'Login Successful',
        'user': _user_payload(user, company),
    })
    cookie_kwargs = dict(
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        path='/',
    )
    response.set_cookie('access_token',  access_token,  max_age=1800,   **cookie_kwargs)
    response.set_cookie('refresh_token', refresh_token, max_age=604800, **cookie_kwargs)
    response.set_cookie('session_uid',   session_uid,   max_age=604800, **cookie_kwargs)
    return response


def _build_apk_token_response(user, company, access_token, refresh_token, session_uid):
    """APK path: tokens + session_uid in response body."""
    return Response({
        'message':       'Login Successful',
        'user':          _user_payload(user, company),
        'access_token':  access_token,
        'refresh_token': refresh_token,
        'session_uid':   session_uid,
    })


def _build_token_response(user, company, session_uid, request):
    """Dispatch to web or APK token response based on request origin."""
    _, access_token, refresh_token = _make_tokens(user, session_uid)
    if _is_apk_request(request):
        return _build_apk_token_response(user, company, access_token, refresh_token, session_uid)
    return _build_web_token_response(user, company, access_token, refresh_token, session_uid)


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
        return User.objects.get(id=token['user_id'])
    except (TokenError, User.DoesNotExist):
        return None


def get_user_from_request(request):
    """
    Dual-path — Bearer header (APK) first, cookie (web) fallback.
    Use this in APK views and shared endpoints.
    """
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        token_str = auth_header[7:]
        try:
            token = AccessToken(token_str)
            return User.objects.get(id=token['user_id'])
        except (TokenError, User.DoesNotExist):
            return None
    return get_user_from_cookie(request)


def _get_session_uid_from_request(request):
    """
    Extract the session_uid claim from the JWT on the current request.
    Works for both web (cookie) and APK (Bearer header).
    """
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        token_str = auth_header[7:]
    else:
        token_str = request.COOKIES.get('access_token')

    if not token_str:
        return None
    try:
        token = AccessToken(token_str)
        return token.get('session_uid')
    except TokenError:
        return None


# ── Session helpers ───────────────────────────────────────────────────────────

def _enforce_single_session(user):
    """
    Block new login if a live session already exists (non-superadmin only).
    Returns an error Response or None if the login may proceed.
    Cleans up stale sessions before the check.
    """
    if user.role == 'superadmin':
        return None  # superadmin is always exempt

    cutoff = timezone.now() - timedelta(days=SESSION_INACTIVITY_DAYS)

    # Kill all sessions that are beyond the inactivity TTL
    UserSession.objects.filter(
        user=user,
        is_active=True,
        last_seen_at__lt=cutoff,
    ).update(is_active=False)

    # Also kill null last_seen_at sessions that are beyond TTL by created_at
    UserSession.objects.filter(
        user=user,
        is_active=True,
        last_seen_at__isnull=True,
        created_at__lt=cutoff,
    ).update(is_active=False)

    # Now check for a genuinely active session
    if UserSession.objects.filter(user=user, is_active=True).exists():
        return Response(
            {
                'error': 'You are already logged in from another device. Please log out first.',
                'error_code': 'ALREADY_LOGGED_IN',
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _create_session(user, request):
    """Create a new UserSession and return its session_uid (str)."""
    session = UserSession.objects.create(
        user=user,
        session_uid=uuid.uuid4(),
        device_type=_detect_device_type(request),
        user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:500],
        is_active=True,
        last_seen_at=timezone.now(),
    )
    return str(session.session_uid)


# ── Views ─────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def signup_view(request):
    """
    Quick-create for initial setup. Not exposed in production UI.
    Web only — does not set up a session.
    """
    if not request.data:
        return Response({'error': 'Invalid Input'}, status=status.HTTP_400_BAD_REQUEST)

    username  = request.data.get('username')
    email     = request.data.get('mailid')
    role      = request.data.get('role', 'company_user')
    password  = request.data.get('password')
    cpassword = request.data.get('cpassword')

    if not username or not email or not password or not cpassword:
        return Response({'error': 'Fill out all the fields'}, status=status.HTTP_400_BAD_REQUEST)

    if password != cpassword:
        return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.create_user(
            username=username, email=email,
            password=password, role=role, is_verified=True,
        )
        return Response({
            'message': 'Account created successfully.',
            'user': {'username': user.username, 'email': user.email, 'role': user.role},
        }, status=status.HTTP_201_CREATED)
    except Exception:
        return Response({'error': 'Failed to create user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def login_view(request):
    """
    Login — Phase 2 flow:

      Step 1  Authenticate credentials.
      Step 2  Entity (company / dealer) active + license checks.
      Step 3  Single-session enforcement (superadmin exempt).
      Step 4  Create UserSession; embed session_uid in JWT.
      Step 5  Issue tokens — cookies (web) or body (APK).
    """
    if not request.data:
        return Response({'error': 'Invalid request. No credentials provided'}, status=status.HTTP_400_BAD_REQUEST)

    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Please provide username and password'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Step 1: Authenticate ──────────────────────────────────────────────────
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
        return Response({'error': 'Account is inactive'}, status=status.HTTP_403_FORBIDDEN)

    # ── Step 2: Entity checks ────────────────────────────────────────────────
    company = user.company
    if company:
        if not company.is_active:
            return Response(
                {'error': 'Company account is deactivated. Contact Administrator.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if company.product_to_date and date.today() > company.product_to_date:
            return Response(
                {'error': f'License Expired (ID: {company.company_id}). Contact Administrator'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if company.authentication_status and company.authentication_status != Company.AuthStatus.APPROVED:
            return Response(
                {'error': 'Pending License Approval. Contact Administrator'},
                status=status.HTTP_403_FORBIDDEN,
            )

    dealer = user.dealer
    if dealer and not dealer.is_active:
        return Response(
            {'error': 'Dealer account is deactivated. Contact Administrator.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # ── Step 3: Single-session enforcement ───────────────────────────────────
    block = _enforce_single_session(user)
    if block:
        return block

    # ── Step 4: Create session + issue tokens ─────────────────────────────────
    session_uid = _create_session(user, request)

    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])

    # ── Step 5: Token response (web cookies or APK body) ─────────────────────
    response = _build_token_response(user, company, session_uid, request)

    # ── Step 6: Attach login notifications (Phase 5) ─────────────────────────
    # Computed after auth so they don't slow down failed login attempts.
    try:
        from .notifications import get_login_notifications
        notifications = get_login_notifications(user, company)
        if notifications:
            response.data['notifications'] = notifications
    except Exception as _exc:
        logger.warning(f"Failed to compute login notifications: {_exc}")

    return response


@api_view(['POST'])
def logout_view(request):
    """
    Logout — mark the UserSession inactive and clear tokens.

    Web: session_uid read from JWT cookie claim.
    APK: session_uid read from JWT Bearer claim (or body fallback).
    """
    session_uid = _get_session_uid_from_request(request)
    if not session_uid:
        # Fallback: APK may pass session_uid in body
        session_uid = request.data.get('session_uid') if hasattr(request, 'data') else None

    if session_uid:
        UserSession.objects.filter(session_uid=session_uid).update(is_active=False)

    # Blacklist the refresh token (async to avoid blocking the response)
    refresh_token_str = (
        request.COOKIES.get('refresh_token')
        or (request.data.get('refresh_token') if hasattr(request, 'data') else None)
    )
    if refresh_token_str:
        try:
            from TicketAppB.tasks import blacklist_refresh_token
            blacklist_refresh_token.delay(refresh_token_str)
        except Exception:
            pass

    if _is_apk_request(request):
        return Response({'message': 'Logged out successfully'})
    return _build_logout_response('Logged out successfully')


@api_view(['POST'])
def refresh_token_view(request):
    """
    Token refresh.

    Web: reads refresh_token from cookie; issues new access_token cookie.
    APK: reads refresh_token from body; returns new access_token in body.
    Both: update UserSession.last_seen_at to keep session alive.
    """
    if _is_apk_request(request):
        refresh_token_str = request.data.get('refresh_token') if hasattr(request, 'data') else None
        session_uid_hint  = request.data.get('session_uid')   if hasattr(request, 'data') else None
    else:
        refresh_token_str = request.COOKIES.get('refresh_token')
        session_uid_hint  = request.COOKIES.get('session_uid')

    if not refresh_token_str:
        return Response({'error': 'No refresh token found'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        refresh = RefreshToken(refresh_token_str)
        session_uid = refresh.get('session_uid') or session_uid_hint

        # Touch the UserSession so the inactivity TTL resets
        if session_uid:
            UserSession.objects.filter(
                session_uid=session_uid,
                is_active=True,
            ).update(last_seen_at=timezone.now())

        new_access_token = str(refresh.access_token)

        if _is_apk_request(request):
            return Response({'message': 'Token refreshed successfully', 'access_token': new_access_token})

        response = Response({'message': 'Token refreshed successfully'})
        response.set_cookie(
            key='access_token', value=new_access_token,
            httponly=True, secure=not settings.DEBUG,
            samesite='Lax', max_age=1800, path='/',
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

    # Invalidate all active sessions so the old password can no longer be used
    # (sessions hold JWTs signed before the password change).
    from ...models import UserSession as _UserSession
    _UserSession.objects.filter(user=user, is_active=True).update(is_active=False)

    logger.info(f"Password reset completed for user_id={user.pk} ({user.username})")
    return Response({'message': 'Password reset successfully. Please log in with your new password.'}, status=status.HTTP_200_OK)
