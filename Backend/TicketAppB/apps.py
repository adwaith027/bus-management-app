from django.apps import AppConfig


class TicketappbConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'TicketAppB'

    # Import signals when Django starts
    def ready(self):
        import TicketAppB.signals

        # Reset any companies stuck in VALIDATING from a previous crashed/killed process.
        # Uses .update() (single SQL query, no per-object overhead).
        # Wrapped in try/except so manage.py migrate/check never breaks if the
        # table doesn't exist yet (fresh install before first migration).
        try:
            from .models import Company
            Company.objects.filter(
                authentication_status=Company.AuthStatus.VALIDATING
            ).update(authentication_status=Company.AuthStatus.PENDING)
        except Exception:
            pass