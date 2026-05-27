"""
Login notifications — Phase 5
==============================
Checks run on every successful login and appended to the login response.
Kept in a separate module so they're cheap to test and extend.

Severity levels: 'error' | 'warning' | 'info'
"""

from datetime import date

from ...models import ETMDevice, Route, RouteDepot

# Days before expiry at which we start warning
_EXPIRY_WARNING_DAYS = 30


def get_login_notifications(user, company):
    """
    Return a list of notification dicts for the logged-in user.
    All checks are fast single-count queries — no heavy aggregations.
    """
    alerts = []

    # ── 1. Company license expiry ─────────────────────────────────────────────
    if company and company.product_to_date:
        days = (company.product_to_date - date.today()).days
        if days < 0:
            alerts.append({
                'type':     'license_expired',
                'severity': 'error',
                'message':  (
                    f'License expired {abs(days)} day(s) ago '
                    f'(ID: {company.company_id}). Contact your administrator.'
                ),
            })
        elif days <= _EXPIRY_WARNING_DAYS:
            alerts.append({
                'type':     'license_expiry_warning',
                'severity': 'warning',
                'message':  (
                    f'License expires in {days} day(s) '
                    f'(ID: {company.company_id}). Please renew soon.'
                ),
                'days_remaining': days,
            })

    # ── 2. Dealer license expiry (for dealer_admin users) ────────────────────
    dealer = getattr(user, 'dealer', None)
    if dealer and dealer.product_to_date:
        days = (dealer.product_to_date - date.today()).days
        if days < 0:
            alerts.append({
                'type':     'dealer_license_expired',
                'severity': 'error',
                'message':  f'Dealer license expired {abs(days)} day(s) ago. Contact support.',
            })
        elif days <= _EXPIRY_WARNING_DAYS:
            alerts.append({
                'type':     'dealer_license_expiry_warning',
                'severity': 'warning',
                'message':  f'Dealer license expires in {days} day(s). Please renew.',
                'days_remaining': days,
            })

    # ── 3. ETM devices allocated but missing Palmtec ID ──────────────────────
    if company:
        unmapped_devices = ETMDevice.objects.filter(
            company=company,
            allocation_status=ETMDevice.AllocationStatus.ALLOCATED,
            palmtec_id__isnull=True,
        ).count()
        if unmapped_devices:
            alerts.append({
                'type':     'unmapped_devices',
                'severity': 'info',
                'message':  (
                    f'{unmapped_devices} device(s) have no Palmtec ID assigned. '
                    'Go to Device Management to enter the IDs.'
                ),
                'count': unmapped_devices,
            })

    # ── 4. Routes with no depot assigned ─────────────────────────────────────
    if company:
        mapped_route_ids = RouteDepot.objects.filter(
            route__company=company,
        ).values_list('route_id', flat=True)

        routes_without_depot = Route.objects.filter(
            company=company,
            is_deleted=False,
        ).exclude(id__in=mapped_route_ids).count()

        if routes_without_depot:
            alerts.append({
                'type':     'unmapped_routes',
                'severity': 'info',
                'message':  (
                    f'{routes_without_depot} route(s) have no depot assigned. '
                    'Assign depots in Route Management.'
                ),
                'count': routes_without_depot,
            })

    return alerts
