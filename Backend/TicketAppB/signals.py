from django.utils import timezone
from django.dispatch import receiver
from django.db.models.signals import post_save, pre_save
from django.contrib.auth import get_user_model
from .models import Route, Fare, Company, Dealer, UserSession
from .authentication import delete_session_cache, set_session_revoked


# COMPANY / DEALER ACTIVE STATUS CASCADE

@receiver(post_save, sender=Company)
def cascade_company_active_status(sender, instance, created, **kwargs):
    if created:
        return
    User = get_user_model()
    User.objects.filter(company=instance).update(is_active=instance.is_active)

    # Fix 3: when a company is deactivated, immediately kill all active sessions
    # for its users. Without this, those users get a 403 (LicensePermission) on
    # every request for up to 20 minutes until their Redis TTL expires, but their
    # sessions still appear as active in the admin session listing and can generate
    # confusing audit noise. Killing them here makes deactivation clean and instant.
    if not instance.is_active:
        active_sessions = UserSession.objects.filter(
            user__company=instance, is_active=True,
        )
        session_uids = list(active_sessions.values_list('session_uid', flat=True))
        active_sessions.update(is_active=False)
        for uid in session_uids:
            uid_str = str(uid)
            set_session_revoked(uid_str)
            delete_session_cache(uid_str)


@receiver(post_save, sender=Dealer)
def cascade_dealer_active_status(sender, instance, created, **kwargs):
    if created:
        return
    User = get_user_model()
    User.objects.filter(dealer=instance).update(is_active=instance.is_active)

    # Fix 3: same as company cascade — kill sessions immediately on deactivation.
    if not instance.is_active:
        active_sessions = UserSession.objects.filter(
            user__dealer=instance, is_active=True,
        )
        session_uids = list(active_sessions.values_list('session_uid', flat=True))
        active_sessions.update(is_active=False)
        for uid in session_uids:
            uid_str = str(uid)
            set_session_revoked(uid_str)
            delete_session_cache(uid_str)


# ROUTE SIGNALS
@receiver(pre_save, sender=Route)
def capture_old_route_name(sender, instance, **kwargs):
    """
    Capture old route_name before save happens.
    Attaches old name to instance so post_save can compare.

    Flow:
    1. Only runs for existing routes (not new ones)
    2. Fetches current DB value before it gets overwritten
    3. Stores it temporarily on the instance object
    """

    # Only for existing routes (pk exists)
    if instance.pk:
        try:
            old = Route.objects.get(pk=instance.pk)
            # Temporarily attach old name to instance
            instance._old_route_name = old.route_name
        except Route.DoesNotExist:
            instance._old_route_name = None
    else:
        # New route being created
        instance._old_route_name = None


@receiver(post_save, sender=Route)
def sync_fare_route_name(sender, instance, created, **kwargs):
    """
    When a Route name is updated, sync route_name in all
    related Fare records automatically.

    Flow:
    1. Skip if this is a new route (no fares exist yet)
    2. Compare old name (captured in pre_save) with new name
    3. If changed, bulk update all related Fare records
    """

    # STEP 1: Skip newly created routes
    if created:
        return

    # STEP 2: Get old name captured by pre_save signal
    old_name = getattr(instance, '_old_route_name', None)

    # STEP 3: Only update if name actually changed
    if old_name and old_name != instance.route_name:
        updated_count = Fare.objects.filter(route=instance).update(
            route_name=instance.route_name
        )
        print(f"✅ Synced route_name '{instance.route_name}' across {updated_count} Fare records")
    else:
        print(f"ℹ️ Route name unchanged - no Fare records updated")