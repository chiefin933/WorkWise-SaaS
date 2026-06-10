"""
Celery application configuration for WorkWise SaaS.

This module defines the Celery app that powers all asynchronous background
tasks — payslip email dispatch, M-Pesa bulk payouts, and future long-running
jobs. The broker and result backend are configured via environment variables
(CELERY_BROKER_URL / CELERY_RESULT_BACKEND) so that the same settings file
works for local Redis, Docker Compose, and production deployments.

Usage:
    Start a worker:
        cd backend && ../venv/bin/celery -A config worker -l info

    Start flower (optional monitoring):
        cd backend && ../venv/bin/celery -A config flower
"""

import os
from celery import Celery

# Tell Celery which Django settings module to use.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('workwise')

# Load configuration from Django settings, looking for CELERY_* keys.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from every installed app's tasks.py module.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Utility task: print request info. Confirms the worker is alive."""
    print(f'[debug_task] Request: {self.request!r}')
