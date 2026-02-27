from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
import logging
from .models import LegalDocument
from .lease_service import process_dropbox_sign_status_update
from .dropbox_sign_service import is_dropbox_sign_configured

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
def check_dropbox_sign_statuses():
    """
    Periodic task to check status of all 'Sent' Dropbox Sign signature requests.
    """
    if not is_dropbox_sign_configured():
        logger.warning("Dropbox Sign not configured, skipping status check task")
        return "Dropbox Sign not configured"

    sent_docs = LegalDocument.objects.filter(
        status='Sent',
        delivery_method='Dropbox Sign'
    ).exclude(dropbox_sign_signature_request_id__isnull=True)

    count = sent_docs.count()
    if count == 0:
        return "No sent signature requests to check"

    logger.info(f"Checking status for {count} Dropbox Sign signature requests")

    updated_count = 0
    errors_count = 0

    for doc in sent_docs:
        try:
            result = process_dropbox_sign_status_update(doc)
            if result.get('updated'):
                updated_count += 1
                logger.info(f"Updated document {doc.id} status to {result.get('status')}")
        except Exception as e:
            errors_count += 1
            logger.error(f"Error checking document {doc.id}: {e}")

    return f"Checked {count} signature requests. Updated: {updated_count}. Errors: {errors_count}"


@shared_task
def check_lease_renewals():
    """
    Periodic task to check for leases expiring in 90, 60, or 30 days.
    Sends renewal reminder emails to tenants.
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import Tenant
    from .email_service import send_lease_renewal_reminder
    
    today = timezone.now().date()
    check_days = [90, 60, 30]
    
    sent_count = 0
    
    for days in check_days:
        target_date = today + timedelta(days=days)
        
        # Find tenants whose lease ends on target_date
        expiring_tenants = Tenant.objects.filter(
            lease_end=target_date,
            lease_status='Active'  # Only active leases
        )
        
        for tenant in expiring_tenants:
            try:
                # Check if tenant has email
                if not tenant.email:
                    continue
                    
                logger.info(f"Sending lease renewal reminder to tenant {tenant.id} ({days} days remaining)")
                
                # Use delay() if Celery is working, or call directly if not configured?
                # shared_task wrapper handles this if imported correctly, but let's use .delay() for async
                send_lease_renewal_reminder.delay(tenant.id, days)
                sent_count += 1
                
            except Exception as e:
                logger.error(f"Error sending lease renewal reminder to tenant {tenant.id}: {e}")
                
    return f"Sent {sent_count} lease renewal reminders"


@shared_task
def send_rent_reminders():
    """
    Periodic task to send rent reminders to tenants.
    Logic:
    1. 3 days before due date (Due date is typically 1st of month)
    2. On due date (1st of month)
    3. Overdue (When status is 'Overdue' or past due date without payment)
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import Payment
    from .email_service import send_payment_reminder_to_tenant
    
    today = timezone.now().date()
    sent_count = 0
    
    # 1. Find payments due in 3 days (Upcoming)
    target_date_3_days = today + timedelta(days=3)
    upcoming_payments = Payment.objects.filter(
        date=target_date_3_days,
        status='Pending'
    )
    
    for payment in upcoming_payments:
        try:
            send_payment_reminder_to_tenant.delay(payment.id)
            sent_count += 1
        except Exception as e:
            logger.error(f"Error sending upcoming rent reminder for payment {payment.id}: {e}")

    # 2. Find payments due today (Due Date)
    due_today_payments = Payment.objects.filter(
        date=today,
        status='Pending'
    )
    
    for payment in due_today_payments:
        try:
            send_payment_reminder_to_tenant.delay(payment.id)
            sent_count += 1
        except Exception as e:
            logger.error(f"Error sending due date rent reminder for payment {payment.id}: {e}")

    # 3. Find payments overdue (Late)
    # We can check for payments with status 'Overdue' OR payments past due date that are still 'Pending'
    # Let's run this check for payments due yesterday to mark them overdue effectively, 
    # OR if we rely on another task to update status to 'Overdue'.
    # Assuming status update happens elsewhere or we check simply for past due pending.
    
    # For notification purposes, let's notify for payments due exactly 1 day ago (now late)
    # AND perhaps payments that are already marked 'Overdue' (e.g. weekly reminder?)
    
    # Logic: Notify on Day 2 (1 day late)
    yesterday = today - timedelta(days=1)
    late_payments = Payment.objects.filter(
        date=yesterday,
        status='Pending'
    )
    
    for payment in late_payments:
        try:
            # Update status to Overdue if not already
            if payment.status != 'Overdue':
                payment.status = 'Overdue'
                payment.save()
                
            send_payment_reminder_to_tenant.delay(payment.id)
            sent_count += 1
        except Exception as e:
            logger.error(f"Error sending late rent reminder for payment {payment.id}: {e}")
            
    return f"Sent {sent_count} rent reminders"



