from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = 'core'
    default_auto_field = 'django.db.models.BigAutoField'
    verbose_name = 'WorkWise Core'

    def ready(self):
        # Connect audit signal handlers so every sensitive write is recorded.
        import core.audit_signals  # noqa: F401
