import json
from datetime import date
from django.core.cache import cache
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model
from django.http import JsonResponse

EXEMPT_PATHS = {"/login", "/token/refresh", "/signup", "/logout"}

User = get_user_model()

# TTL for the online presence key (seconds). 5 minutes matches typical API polling cadence.
_ONLINE_TTL = 300


class UserOnlineMiddleware:
    """
    Marks authenticated users as online in Redis cache.
    Key expires automatically — no logout hook needed.
    Use cache.get(f"user_online_{user_id}") to check presence anywhere.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token_str = request.COOKIES.get("access_token")
        if token_str:
            try:
                token = AccessToken(token_str)
                cache.set(f"user_online_{token['user_id']}", True, _ONLINE_TTL)
            except (TokenError, Exception):
                pass
        return self.get_response(request)


class LicenseExpiryMiddleware:
    """
    Checks company license on every request.
    Blocks with 403 if the license has expired, regardless of whether
    the view uses DRF permissions or the custom get_user_from_cookie helper.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path.rstrip("/")

        if not any(path.endswith(ep.rstrip("/")) for ep in EXEMPT_PATHS):
            user = self._get_user(request)
            if user and not user.is_superuser:
                company = getattr(user, "company", None)
                if company:
                    if not company.is_active:
                        return JsonResponse(
                            {"error": "Company account is deactivated. Contact Administrator."},
                            status=403,
                        )
                    if company.product_to_date and date.today() > company.product_to_date:
                        return JsonResponse(
                            {"error": f"License Expired (ID: {company.company_id}). Contact Administrator."},
                            status=403,
                        )

                dealer = getattr(user, "dealer", None)
                if dealer and not dealer.is_active:
                    return JsonResponse(
                        {"error": "Dealer account is deactivated. Contact Administrator."},
                        status=403,
                    )

        return self.get_response(request)

    def _get_user(self, request):
        token_str = request.COOKIES.get("access_token")
        if not token_str:
            return None
        try:
            token = AccessToken(token_str)
            return User.objects.get(id=token["user_id"])
        except (TokenError, User.DoesNotExist, Exception):
            return None
