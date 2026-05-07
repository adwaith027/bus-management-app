import json
from datetime import date
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model
from django.http import JsonResponse

EXEMPT_PATHS = {"/login", "/token/refresh", "/signup", "/logout"}

User = get_user_model()


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
                if company and company.product_to_date and date.today() > company.product_to_date:
                    return JsonResponse(
                        {"error": f"License Expired (ID: {company.company_id}). Contact Administrator."},
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
