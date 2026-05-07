from rest_framework import status
from rest_framework.response import Response
from django.core.cache import cache

# ── Role constants ────────────────────────────────────────────────────────────
ROLE_SUPERADMIN   = 'superadmin'
ROLE_EXECUTIVE    = 'executive'
ROLE_DEALER_ADMIN = 'dealer_admin'
ROLE_COMPANY_ADMIN = 'company_admin'

# ── Role checkers ─────────────────────────────────────────────────────────────
def _is_superadmin(user):
    return user and user.role == ROLE_SUPERADMIN

def _is_executive(user):
    return user and user.role == ROLE_EXECUTIVE

def _is_dealer_admin(user):
    return user and user.role == ROLE_DEALER_ADMIN

def _is_company_admin(user):
    return user and user.role == ROLE_COMPANY_ADMIN

def _is_superadmin_or_executive(user):
    return user and user.role in (ROLE_SUPERADMIN, ROLE_EXECUTIVE)

def _can_manage_devices(user):
    """Superadmin and executive can approve/reject ETM devices."""
    return _is_superadmin_or_executive(user)


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
