from rest_framework import status
from rest_framework.response import Response
from django.core.cache import cache


def reset_pending_on_startup():
    from ..models import Company
    companies = Company.objects.filter(authentication_status=Company.AuthStatus.VALIDATING)
    for c in companies:
        c.authentication_status = Company.AuthStatus.PENDING
        c.save()


def _is_superadmin(user):
    return user and user.role == "superadmin"


def _get_company(company_id):
    key = f"company:{company_id}"
    company = cache.get(key)
    if company is None:
        from ..models import Company
        company = Company.objects.filter(company_id=company_id).first()
        if company:
            cache.set(key, company, timeout=3600)
    return company


def _get_authenticated_company_admin(request):
    from .auth_views import get_user_from_cookie
    user = get_user_from_cookie(request)
    if not user:
        return None, None, Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    if user.role != 'company_admin':
        return None, None, Response(
            {'error': 'Only company admins can access this.'},
            status=status.HTTP_403_FORBIDDEN
        )
    company = user.company
    if not company:
        return None, None, Response(
            {'error': 'No company mapped to this user.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    return user, company, None


def _get_object_or_404(model, pk, company):
    try:
        obj = model.objects.get(pk=pk, company=company)
        return obj, None
    except model.DoesNotExist:
        return None, Response(
            {'error': f'{model.__name__} not found.'},
            status=status.HTTP_404_NOT_FOUND
        )
