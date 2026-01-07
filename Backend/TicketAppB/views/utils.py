
def reset_pending_on_startup():
    from ..models import Company
    companies = Company.objects.filter(authentication_status=Company.AuthStatus.VALIDATING)
    for c in companies:
        c.authentication_status = Company.AuthStatus.PENDING
        c.save()