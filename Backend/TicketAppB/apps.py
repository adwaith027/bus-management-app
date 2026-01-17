from django.apps import AppConfig


class TicketappbConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'TicketAppB'

    # Import signals when Django starts
    def ready(self):
        import TicketAppB.signals