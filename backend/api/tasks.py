from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
import logging
from .models import LegalDocument
from .lease_service import process_docusign_status_update
from .docusign_service import is_docusign_configured

logger = logging.getLogger(__name__)

@shared_task
def send_test_email():
    try:
        result = send_mail(
            "Celery Test",
            "This is a test email sent via Celery.",
            "fadahunsipaul@gmail.com",
            ["wahiga8943@bipochub.com"],
            fail_silently=False
        )
        logger.info(f"Email sent successfully, result={result}")
    except Exception as e:
        logger.error(f"Email sending failed: {e}")


@shared_task
def check_docusign_envelope_statuses():
    """
    Periodic task to check status of all 'Sent' DocuSign envelopes.
    Updates local status if envelope is completed, voided, or declined.
    """
    if not is_docusign_configured():
        logger.warning("DocuSign not configured, skipping status check task")
        return "DocuSign not configured"

    # Find sent envelopes
    sent_docs = LegalDocument.objects.filter(
        status='Sent', 
        delivery_method='DocuSign'
    ).exclude(docusign_envelope_id__isnull=True)
    
    count = sent_docs.count()
    if count == 0:
        return "No sent envelopes to check"
        
    logger.info(f"Checking status for {count} sent DocuSign envelopes")
    
    updated_count = 0
    errors_count = 0
    
    for doc in sent_docs:
        try:
            result = process_docusign_status_update(doc)
            if result.get('updated'):
                updated_count += 1
                logger.info(f"Updated document {doc.id} status to {result.get('status')}")
        except Exception as e:
            errors_count += 1
            logger.error(f"Error checking document {doc.id}: {e}")
            
    return f"Checked {count} envelopes. Updated: {updated_count}. Errors: {errors_count}"

