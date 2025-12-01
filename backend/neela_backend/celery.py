"""
Celery configuration for neela_backend project.
"""
import os
# import django  <-- Removed to prevent re-entrant setup
from celery import Celery
from dotenv import load_dotenv
import logging

# Set the default Django settings module for the 'celery' program.
# This must be done before importing other Django parts
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neela_backend.settings')

# Load environment variables from .env file
load_dotenv()

# Initialize Celery app
app = Celery('neela_backend')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

logger = logging.getLogger(__name__)

# We can access settings lazily inside tasks or after app is ready, 
# but for top-level logging we rely on what's available.
try:
    from django.conf import settings
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'not configured')
    email_host_user = getattr(settings, 'EMAIL_HOST_USER', '')
    
    logger.info(f"Celery worker initialized. Email backend: {email_backend}")
    if 'smtp' in str(email_backend).lower():
        if email_host_user:
            logger.info(f"SMTP configured: {email_host_user}")
        else:
            logger.warning("SMTP backend selected but EMAIL_HOST_USER is not set")
    elif 'console' in str(email_backend).lower():
        logger.warning("Console email backend is active - emails will be printed to terminal")
except Exception:
    pass

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


# Configure periodic tasks
from celery.schedules import crontab

app.conf.beat_schedule = {
    'check-docusign-statuses-every-15-minutes': {
        'task': 'api.tasks.check_docusign_envelope_statuses',
        'schedule': crontab(minute='*/15'),  # Run every 15 minutes
    },
    'check-lease-renewals-daily': {
        'task': 'api.tasks.check_lease_renewals',
        'schedule': crontab(hour=9, minute=0),  # Run daily at 9 AM
    },
    'send-rent-reminders-daily': {
        'task': 'api.tasks.send_rent_reminders',
        'schedule': crontab(hour=8, minute=0),  # Run daily at 8 AM
    },
}

