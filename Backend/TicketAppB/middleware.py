"""
Middleware — Phase 2
====================
Both middlewares now support dual-path auth:
  Web  → access_token HttpOnly cookie
  APK  → Authorization: Bearer <access_token> header

UserOnlineMiddleware
    Marks the authenticated user as online in Redis (5-min TTL).
    No logout hook needed — the key simply expires.

LicenseExpiryMiddleware
    Blocks requests with 403 if:
      - The user's company is inactive or its license has expired.
      - The user's dealer is inactive.
    Superadmin and superuser accounts are fully exempt.
    Exempt paths (login, refresh, logout, signup) are always skipped.
"""

from datetime import date
from django.core.cache import cache
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model
from django.http import JsonResponse

EXEMPT_PATHS = {
    '/login',
    '/token/refresh',
    '/signup',
    '/logout',
    '/auth/forgot-password',
    '/auth/reset-password',
}

User = get_user_model()

# TTL for the online presence key (seconds).  5 minutes matches a typical
# API polling cadence; the key auto-expires so no explicit cleanup is needed.
_ONLINE_TTL = 300


def _extract_token_str(request):
    """
    Return the raw JWT access-token string from either source, or None.
    Priority: Authorization: Bearer header (APK) → access_token cookie (web).
    """
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return request.COOKIES.get('access_token')


def _get_user_from_token_str(token_str):
    """Validate the JWT string and return the User object, or None on any error."""
    if not token_str:
        return None
    try:
        token = AccessToken(token_str)
        return User.objects.select_related('company', 'dealer').get(id=token['user_id'])
    except (TokenError, User.DoesNotExist, Exception):
        return None


class UserOnlineMiddleware:
    """
    Set a Redis key 'user_online_<id>' = True (TTL: 5 min) for every
    authenticated request. Downstream code can call
    ``cache.get(f"user_online_{user_id}")`` to check presence.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token_str = _extract_token_str(request)
        if token_str:
            try:
                token = AccessToken(token_str)
                cache.set(f"user_online_{token['user_id']}", True, _ONLINE_TTL)
            except (TokenError, Exception):
                pass
        return self.get_response(request)


class LicenseExpiryMiddleware:
    """
    Per-request license gate.  Exempt paths and superadmin are skipped.
    Works for both web (cookie) and APK (Bearer header) requests.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path.rstrip('/')

        if not any(path.endswith(ep.rstrip('/')) for ep in EXEMPT_PATHS):
            user = _get_user_from_token_str(_extract_token_str(request))

            if user and not user.is_superuser and user.role != 'superadmin':
                company = getattr(user, 'company', None)
                if company:
                    if not company.is_active:
                        return JsonResponse(
                            {'error': 'Company account is deactivated. Contact Administrator.'},
                            status=403,
                        )
                    if company.product_to_date and date.today() > company.product_to_date:
                        return JsonResponse(
                            {'error': f'License Expired (ID: {company.company_id}). Contact Administrator.'},
                            status=403,
                        )

                dealer = getattr(user, 'dealer', None)
                if dealer and not dealer.is_active:
                    return JsonResponse(
                        {'error': 'Dealer account is deactivated. Contact Administrator.'},
                        status=403,
                    )

        return self.get_response(request)
