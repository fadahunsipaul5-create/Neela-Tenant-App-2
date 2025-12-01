"""
Email service for sending application-related emails.
"""
import threading
import logging
from django.core.mail import send_mail, EmailMessage
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except ImportError:
    # Celery not available, use threading for async execution
    CELERY_AVAILABLE = False
    def shared_task(func):
        return func

User = get_user_model()

# tasks.py
from celery import shared_task
from django.core.mail import send_mail
import logging
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


def validate_email_config():
    """
    Validate email configuration before sending.
    Returns (is_valid, error_message) tuple.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', '')
    default_from = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
    
    if not default_from:
        return False, "DEFAULT_FROM_EMAIL is not configured"
    
    # For SMTP backend, check if credentials are set
    if 'smtp' in email_backend.lower():
        email_host_user = getattr(settings, 'EMAIL_HOST_USER', '')
        if not email_host_user:
            return False, "EMAIL_HOST_USER is not configured for SMTP backend"
    
    return True, None


def send_email_with_logging(subject, message, from_email, recipient_list, html_message=None, email_type="email"):
    """
    Wrapper around send_mail with proper logging, validation, and error handling.
    Falls back to console backend if SMTP fails in DEBUG mode.
    
    Args:
        subject: Email subject
        message: Plain text message
        from_email: Sender email
        recipient_list: List of recipient emails
        html_message: Optional HTML message
        email_type: Description of email type for logging
    
    Returns:
        Number of emails sent (0 on failure)
    """
    # Validate email configuration
    is_valid, error_msg = validate_email_config()
    if not is_valid:
        logger.error(f"Cannot send {email_type}: {error_msg}")
        return 0
    
    # Log email attempt
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Attempting to send {email_type} to {len(recipient_list)} recipient(s) using {email_backend}")
    logger.debug(f"Recipients: {recipient_list}, From: {from_email}, Subject: {subject}")
    
    # Use fail_silently=False in DEBUG mode to catch errors, True in production
    fail_silently = not getattr(settings, 'DEBUG', False)
    
    try:
        result = send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            html_message=html_message,
            fail_silently=fail_silently
        )
        
        if result > 0:
            logger.info(f"{email_type} sent successfully to {recipient_list} (sent {result} email(s))")
        else:
            logger.error(f"Failed to send {email_type}: send_mail returned {result} (0 indicates failure)")
        
        return result
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        
        # Provide more helpful error messages for common SMTP issues
        if 'SMTPServerDisconnected' in error_type or 'Connection unexpectedly closed' in error_msg:
            logger.error(
                f"SMTP connection error sending {email_type}: {error_msg}\n"
                f"Possible causes:\n"
                f"  - SMTP server rejected the connection\n"
                f"  - Incorrect EMAIL_HOST or EMAIL_PORT\n"
                f"  - Firewall blocking SMTP connection\n"
                f"  - Gmail requires app-specific password (not regular password)\n"
                f"  - EMAIL_HOST_USER or EMAIL_HOST_PASSWORD incorrect\n"
                f"Email backend: {email_backend}, Host: {getattr(settings, 'EMAIL_HOST', 'not set')}, "
                f"Port: {getattr(settings, 'EMAIL_PORT', 'not set')}, "
                f"User: {getattr(settings, 'EMAIL_HOST_USER', 'not set')}",
                exc_info=True
            )
            
            # In DEBUG mode, try falling back to console backend if SMTP fails
            if getattr(settings, 'DEBUG', False) and 'smtp' in email_backend.lower():
                logger.warning(f"SMTP failed in DEBUG mode. Falling back to console backend for {email_type}")
                try:
                    from django.core.mail import get_connection
                    console_connection = get_connection('django.core.mail.backends.console.EmailBackend')
                    email_message = EmailMessage(
                        subject=subject,
                        body=html_message if html_message else message,
                        from_email=from_email,
                        to=recipient_list,
                    )
                    if html_message:
                        email_message.content_subtype = 'html'
                    result = console_connection.send_messages([email_message])
                    if result > 0:
                        logger.info(f"{email_type} sent via console backend fallback (sent {result} email(s))")
                        return result
                except Exception as fallback_error:
                    logger.error(f"Console backend fallback also failed: {fallback_error}", exc_info=True)
            
        elif 'SMTPAuthenticationError' in error_type or 'authentication failed' in error_msg.lower():
            logger.error(
                f"SMTP authentication error sending {email_type}: {error_msg}\n"
                f"Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD. "
                f"For Gmail, you may need to use an app-specific password.",
                exc_info=True
            )
        else:
            logger.error(f"Error sending {email_type}: {error_type}: {error_msg}", exc_info=True)
        
        return 0


def send_email_in_thread(email_func, *args, **kwargs):

    email_backend = getattr(settings, 'EMAIL_BACKEND', '')
    
    # For console backend, send synchronously to ensure output is visible
    if 'console' in email_backend.lower():
        logger.info(f"Sending email synchronously (console backend) for {email_func.__name__}")
        try:
            email_func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error sending email: {e}", exc_info=True)
        return
    
    # For other backends, use threading
    def _send_email():
        try:
            email_func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error sending email in thread: {e}", exc_info=True)
    
    thread = threading.Thread(target=_send_email, daemon=True)
    thread.start()
    logger.info(f"Email sending started in background thread for {email_func.__name__}")


def get_admin_emails():
    """
    Get admin email addresses for notifications.
    Returns list of admin emails from staff users or ADMIN_EMAIL setting.
    Optimized to fetch only email field for faster queries.
    """
    admin_email = getattr(settings, 'ADMIN_EMAIL', '')
    if admin_email:
        return [admin_email]
    
    try:
        # Get all staff users' emails - only fetch email field for performance
        staff_users = User.objects.filter(is_staff=True, is_active=True).only('email')
        admin_emails = [user.email for user in staff_users if user.email]
        
        if not admin_emails:
            # Fallback to superuser emails - only fetch email field for performance
            superusers = User.objects.filter(is_superuser=True, is_active=True).only('email')
            admin_emails = [user.email for user in superusers if user.email]
        
        return admin_emails if admin_emails else [settings.DEFAULT_FROM_EMAIL]
    except Exception as e:
        # If User table doesn't exist or query fails, use DEFAULT_FROM_EMAIL
        # This prevents crashes during development when tables aren't set up yet
        logger.warning(f"Error fetching admin emails: {e}")
        default_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'admin@example.com')
        if default_email:
            return [default_email]
        return ['admin@example.com']  # Final fallback


def _send_application_notification_to_admin(tenant_id):
    """
    Internal function to send email notification to admin.
    This is the actual email sending logic.
    """
    from .models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return
    
    admin_emails = get_admin_emails()
    
    if not admin_emails:
        return
    
    subject = f'New Property Application: {tenant.name}'
    
    # Get admin login URL (base frontend URL - admin can click Admin Login button)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    admin_login_url = f"{frontend_url.rstrip('/')}/admin-login"
    
    # Render email template
    context = {
        'tenant': tenant,
        'property_unit': tenant.property_unit,
        'email': tenant.email,
        'phone': tenant.phone,
        'admin_login_url': admin_login_url,
    }
    
    html_message = render_to_string('emails/application_notification.html', context)
    plain_message = f"""
    New Property Application Received
    
    Applicant: {tenant.name}
    Email: {tenant.email}
    Phone: {tenant.phone}
    Property Unit: {tenant.property_unit}
    Status: {tenant.status}
    
    Please log in to review the application:
    {admin_login_url}
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=admin_emails,
        html_message=html_message,
        email_type="application notification email"
    )


@shared_task
def send_application_notification_to_admin(tenant_id):
    """
    Celery task to send email notification to admin when a user applies for a property.
    This function is decorated with @shared_task, so it runs as a Celery task.
    When called from views with .delay(), it will be executed by Celery worker.
    
    Args:
        tenant_id: ID of the Tenant (application) instance
    """
    # Log email backend being used
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_application_notification_to_admin for tenant {tenant_id}, using email backend: {email_backend}")
    
    # Directly call the internal function - this runs in the Celery worker context
    _send_application_notification_to_admin(tenant_id)


def _send_acceptance_email_to_user(tenant_id, reset_token, reset_url):
    """
    Internal function to send acceptance email to user.
    This is the actual email sending logic.
    """
    from .models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return
    
    if not tenant.email:
        return
    
    subject = 'Your Property Application Has Been Approved!'
    
    # Render email template
    context = {
        'tenant': tenant,
        'name': tenant.name,
        'property_unit': tenant.property_unit,
        'reset_url': reset_url,
    }
    
    html_message = render_to_string('emails/application_acceptance.html', context)
    plain_message = f"""
    Congratulations {tenant.name}!
    
    Your application for {tenant.property_unit} has been approved!
    
    To get started, please set up your account password by clicking the link below:
    {reset_url}
    
    This link will expire in 48 hours.
    
    If you did not apply for this property, please ignore this email.
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[tenant.email],
        html_message=html_message,
        email_type="acceptance email"
    )


@shared_task
def send_acceptance_email_to_user(tenant_id, reset_token, reset_url):
    """
    Celery task to send acceptance email to user with password reset link when application is approved.
    
    Args:
        tenant_id: ID of the Tenant instance
        reset_token: Password reset token
        reset_url: Full URL for password reset
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_acceptance_email_to_user for tenant {tenant_id}, using email backend: {email_backend}")
    _send_acceptance_email_to_user(tenant_id, reset_token, reset_url)


# ==================== Maintenance Request Email Functions ====================

def _send_maintenance_ticket_notification_to_manager(maintenance_request_id):
    """
    Internal function to send email notification to manager when tenant submits maintenance ticket.
    """
    from .models import MaintenanceRequest
    
    try:
        maintenance_request = MaintenanceRequest.objects.select_related('tenant').get(id=maintenance_request_id)
    except MaintenanceRequest.DoesNotExist:
        logger.error(f"Maintenance request with ID {maintenance_request_id} not found for manager notification.")
        return
    
    admin_emails = get_admin_emails()
    if not admin_emails:
        logger.warning("No admin emails configured for maintenance ticket notification.")
        return
    
    subject = f'New Maintenance Request: {maintenance_request.category} - {maintenance_request.tenant.name}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    admin_login_url = f"{frontend_url.rstrip('/')}/admin-login"
    
    context = {
        'tenant': maintenance_request.tenant,
        'category': maintenance_request.category,
        'description': maintenance_request.description,
        'priority': maintenance_request.priority,
        'created_at': maintenance_request.created_at,
        'admin_login_url': admin_login_url,
    }
    
    html_message = render_to_string('emails/maintenance_ticket_submitted.html', context)
    plain_message = f"""
    New Maintenance Request Received
    
    Tenant: {maintenance_request.tenant.name}
    Property Unit: {maintenance_request.tenant.property_unit}
    Category: {maintenance_request.category}
    Priority: {maintenance_request.priority}
    Description: {maintenance_request.description}
    Submitted: {maintenance_request.created_at}
    
    Please log in to review and manage this request:
    {admin_login_url}
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=admin_emails,
        html_message=html_message,
        email_type=f"maintenance ticket notification email (request {maintenance_request.id})"
    )


@shared_task
def send_maintenance_ticket_notification_to_manager(maintenance_request_id):
    """
    Celery task to send email notification to manager when tenant submits maintenance ticket.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_maintenance_ticket_notification_to_manager for request {maintenance_request_id}, using email backend: {email_backend}")
    _send_maintenance_ticket_notification_to_manager(maintenance_request_id)


def _send_maintenance_ticket_confirmation_to_tenant(maintenance_request_id):
    """
    Internal function to send confirmation email to tenant when maintenance ticket is created.
    """
    from .models import MaintenanceRequest
    
    try:
        maintenance_request = MaintenanceRequest.objects.select_related('tenant').get(id=maintenance_request_id)
    except MaintenanceRequest.DoesNotExist:
        logger.error(f"Maintenance request with ID {maintenance_request_id} not found for tenant confirmation.")
        return
    
    if not maintenance_request.tenant.email:
        logger.warning(f"Tenant {maintenance_request.tenant.id} has no email address for maintenance confirmation.")
        return
    
    subject = f'Maintenance Request Confirmation - Ticket #{maintenance_request.id}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    tenant_portal_url = f"{frontend_url.rstrip('/')}"
    
    context = {
        'tenant_name': maintenance_request.tenant.name,
        'ticket_id': maintenance_request.id,
        'category': maintenance_request.category,
        'description': maintenance_request.description,
        'priority': maintenance_request.priority,
        'status': maintenance_request.status,
        'created_at': maintenance_request.created_at,
        'tenant_portal_url': tenant_portal_url,
    }
    
    html_message = render_to_string('emails/maintenance_ticket_confirmation.html', context)
    plain_message = f"""
    Maintenance Request Confirmation
    
    Dear {maintenance_request.tenant.name},
    
    Your maintenance request has been submitted successfully.
    
    Ticket #: {maintenance_request.id}
    Category: {maintenance_request.category}
    Priority: {maintenance_request.priority}
    Status: {maintenance_request.status}
    Description: {maintenance_request.description}
    Submitted: {maintenance_request.created_at}
    
    You can track the status of your request in your tenant portal:
    {tenant_portal_url}
    
    Thank you,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[maintenance_request.tenant.email],
        html_message=html_message,
        email_type=f"maintenance ticket confirmation email (request {maintenance_request.id})"
    )


@shared_task
def send_maintenance_ticket_confirmation_to_tenant(maintenance_request_id):
    """
    Celery task to send confirmation email to tenant when maintenance ticket is created.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_maintenance_ticket_confirmation_to_tenant for request {maintenance_request_id}, using email backend: {email_backend}")
    _send_maintenance_ticket_confirmation_to_tenant(maintenance_request_id)


def _send_maintenance_status_update_to_tenant(maintenance_request_id, old_status, new_status, update_message=None):
    """
    Internal function to send email to tenant when maintenance ticket status changes.
    """
    from .models import MaintenanceRequest
    
    try:
        maintenance_request = MaintenanceRequest.objects.select_related('tenant').get(id=maintenance_request_id)
    except MaintenanceRequest.DoesNotExist:
        logger.error(f"Maintenance request with ID {maintenance_request_id} not found for status update email.")
        return
    
    if not maintenance_request.tenant.email:
        logger.warning(f"Tenant {maintenance_request.tenant.id} has no email address for maintenance status update.")
        return
    
    subject = f'Maintenance Request Status Update - Ticket #{maintenance_request.id}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    tenant_portal_url = f"{frontend_url.rstrip('/')}"
    
    context = {
        'tenant_name': maintenance_request.tenant.name,
        'ticket_id': maintenance_request.id,
        'category': maintenance_request.category,
        'description': maintenance_request.description,
        'status': new_status,
        'assigned_to': maintenance_request.assigned_to,
        'update_message': update_message,
        'tenant_portal_url': tenant_portal_url,
    }
    
    html_message = render_to_string('emails/maintenance_status_update.html', context)
    plain_message = f"""
    Maintenance Request Status Update
    
    Dear {maintenance_request.tenant.name},
    
    Your maintenance request status has been updated.
    
    Ticket #: {maintenance_request.id}
    Category: {maintenance_request.category}
    Previous Status: {old_status}
    New Status: {new_status}
    """
    
    if update_message:
        plain_message += f"\nUpdate: {update_message}\n"
    
    if maintenance_request.assigned_to:
        plain_message += f"Assigned To: {maintenance_request.assigned_to}\n"
    
    plain_message += f"""
    You can view the full details in your tenant portal:
    {tenant_portal_url}
    
    Best regards,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[maintenance_request.tenant.email],
        html_message=html_message,
        email_type=f"maintenance status update email (request {maintenance_request.id})"
    )


@shared_task
def send_maintenance_status_update_to_tenant(maintenance_request_id, old_status, new_status, update_message=None):
    """
    Celery task to send email to tenant when maintenance ticket status changes.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_maintenance_status_update_to_tenant for request {maintenance_request_id}, using email backend: {email_backend}")
    _send_maintenance_status_update_to_tenant(maintenance_request_id, old_status, new_status, update_message)


def _send_maintenance_comment_notification_to_tenant(maintenance_request_id, comment_author, comment_message, comment_date):
    """
    Internal function to send email to tenant when manager adds a comment to maintenance ticket.
    """
    from .models import MaintenanceRequest
    
    try:
        maintenance_request = MaintenanceRequest.objects.select_related('tenant').get(id=maintenance_request_id)
    except MaintenanceRequest.DoesNotExist:
        logger.error(f"Maintenance request with ID {maintenance_request_id} not found for comment notification.")
        return
    
    if not maintenance_request.tenant.email:
        logger.warning(f"Tenant {maintenance_request.tenant.id} has no email address for maintenance comment notification.")
        return
    
    subject = f'New Comment on Maintenance Request - Ticket #{maintenance_request.id}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    tenant_portal_url = f"{frontend_url.rstrip('/')}"
    
    context = {
        'tenant_name': maintenance_request.tenant.name,
        'ticket_id': maintenance_request.id,
        'category': maintenance_request.category,
        'description': maintenance_request.description,
        'status': maintenance_request.status,
        'comment_author': comment_author,
        'comment_message': comment_message,
        'comment_date': comment_date,
        'tenant_portal_url': tenant_portal_url,
    }
    
    html_message = render_to_string('emails/maintenance_comment_added.html', context)
    plain_message = f"""
    New Comment on Maintenance Request
    
    Dear {maintenance_request.tenant.name},
    
    A new comment has been added to your maintenance request.
    
    Ticket #: {maintenance_request.id}
    Category: {maintenance_request.category}
    Status: {maintenance_request.status}
    
    Comment from {comment_author} ({comment_date}):
    {comment_message}
    
    You can view and reply to comments in your tenant portal:
    {tenant_portal_url}
    
    Best regards,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[maintenance_request.tenant.email],
        html_message=html_message,
        email_type=f"maintenance comment notification email (request {maintenance_request.id})"
    )


@shared_task
def send_maintenance_comment_notification_to_tenant(maintenance_request_id, comment_author, comment_message, comment_date):
    """
    Celery task to send email to tenant when manager adds a comment to maintenance ticket.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_maintenance_comment_notification_to_tenant for request {maintenance_request_id}, using email backend: {email_backend}")
    _send_maintenance_comment_notification_to_tenant(maintenance_request_id, comment_author, comment_message, comment_date)


# ==================== Payment Email Functions ====================

def _send_payment_invoice_to_tenant(payment_id):
    """
    Internal function to send invoice email to tenant when payment is created.
    """
    from .models import Payment
    
    try:
        payment = Payment.objects.select_related('tenant').get(id=payment_id)
    except Payment.DoesNotExist:
        logger.error(f"Payment with ID {payment_id} not found for invoice email.")
        return
    
    if not payment.tenant.email:
        logger.warning(f"Tenant {payment.tenant.id} has no email address for payment invoice.")
        return
    
    subject = f'Payment Invoice - ${payment.amount} - {payment.type}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    payment_url = f"{frontend_url.rstrip('/')}"
    
    context = {
        'tenant_name': payment.tenant.name,
        'amount': payment.amount,
        'payment_type': payment.type,
        'due_date': payment.date,
        'status': payment.status,
        'property_unit': payment.tenant.property_unit,
        'reference': payment.reference,
        'payment_url': payment_url,
    }
    
    html_message = render_to_string('emails/payment_invoice.html', context)
    plain_message = f"""
    Payment Invoice
    
    Dear {payment.tenant.name},
    
    A new invoice has been generated for your account.
    
    Amount: ${payment.amount}
    Payment Type: {payment.type}
    Due Date: {payment.date}
    Status: {payment.status}
    Property Unit: {payment.tenant.property_unit}
    """
    
    if payment.reference:
        plain_message += f"Reference: {payment.reference}\n"
    
    plain_message += f"""
    Please make your payment by the due date to avoid late fees.
    
    Pay online: {payment_url}
    
    Thank you,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[payment.tenant.email],
        html_message=html_message,
        email_type=f"payment invoice email (payment {payment.id})"
    )


@shared_task
def send_payment_invoice_to_tenant(payment_id):
    """
    Celery task to send invoice email to tenant when payment is created.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_payment_invoice_to_tenant for payment {payment_id}, using email backend: {email_backend}")
    _send_payment_invoice_to_tenant(payment_id)


def _send_payment_reminder_to_tenant(payment_id):
    """
    Internal function to send reminder email to tenant for pending/overdue payments.
    """
    from .models import Payment
    from django.utils import timezone
    
    try:
        payment = Payment.objects.select_related('tenant').get(id=payment_id)
    except Payment.DoesNotExist:
        logger.error(f"Payment with ID {payment_id} not found for reminder email.")
        return
    
    if not payment.tenant.email:
        logger.warning(f"Tenant {payment.tenant.id} has no email address for payment reminder.")
        return
    
    is_overdue = payment.status == 'Overdue' or (payment.status == 'Pending' and payment.date < timezone.now().date())
    
    subject = f'Payment Reminder - ${payment.amount} - {payment.type}'
    if is_overdue:
        subject = f'⚠️ Overdue Payment - ${payment.amount} - {payment.type}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    payment_url = f"{frontend_url.rstrip('/')}"
    
    context = {
        'tenant_name': payment.tenant.name,
        'amount': payment.amount,
        'payment_type': payment.type,
        'due_date': payment.date,
        'status': payment.status,
        'property_unit': payment.tenant.property_unit,
        'is_overdue': is_overdue,
        'payment_url': payment_url,
    }
    
    html_message = render_to_string('emails/payment_reminder.html', context)
    plain_message = f"""
    Payment Reminder
    
    Dear {payment.tenant.name},
    
    """
    
    if is_overdue:
        plain_message += "⚠️ This payment is OVERDUE. Please make payment as soon as possible to avoid additional fees.\n\n"
    else:
        plain_message += "This is a friendly reminder that you have a pending payment.\n\n"
    
    plain_message += f"""
    Amount: ${payment.amount}
    Payment Type: {payment.type}
    Due Date: {payment.date}
    Status: {payment.status}
    Property Unit: {payment.tenant.property_unit}
    
    Please make your payment: {payment_url}
    
    Thank you,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[payment.tenant.email],
        html_message=html_message,
        email_type=f"payment reminder email (payment {payment.id})"
    )


@shared_task
def send_payment_reminder_to_tenant(payment_id):
    """
    Celery task to send reminder email to tenant for pending/overdue payments.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_payment_reminder_to_tenant for payment {payment_id}, using email backend: {email_backend}")
    _send_payment_reminder_to_tenant(payment_id)


def _send_payment_receipt_to_tenant(payment_id):
    """
    Internal function to send receipt email to tenant when payment status changes to 'Paid'.
    """
    from .models import Payment
    
    try:
        payment = Payment.objects.select_related('tenant').get(id=payment_id)
    except Payment.DoesNotExist:
        logger.error(f"Payment with ID {payment_id} not found for receipt email.")
        return
    
    if not payment.tenant.email:
        logger.warning(f"Tenant {payment.tenant.id} has no email address for payment receipt.")
        return
    
    subject = f'Payment Receipt - ${payment.amount} - {payment.type}'
    
    context = {
        'tenant_name': payment.tenant.name,
        'amount': payment.amount,
        'payment_type': payment.type,
        'payment_date': payment.date,
        'payment_method': payment.method,
        'property_unit': payment.tenant.property_unit,
        'reference': payment.reference,
        'status': payment.status,
    }
    
    html_message = render_to_string('emails/payment_receipt.html', context)
    plain_message = f"""
    Payment Receipt
    
    Dear {payment.tenant.name},
    
    Thank you for your payment!
    
    Amount: ${payment.amount}
    Payment Type: {payment.type}
    Payment Date: {payment.date}
    Payment Method: {payment.method}
    Property Unit: {payment.tenant.property_unit}
    Status: {payment.status}
    """
    
    if payment.reference:
        plain_message += f"Transaction Reference: {payment.reference}\n"
    
    plain_message += """
    This email serves as your receipt for this payment. Please keep it for your records.
    
    Thank you,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[payment.tenant.email],
        html_message=html_message,
        email_type=f"payment receipt email (payment {payment.id})"
    )


@shared_task
def send_payment_receipt_to_tenant(payment_id):
    """
    Celery task to send receipt email to tenant when payment status changes to 'Paid'.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_payment_receipt_to_tenant for payment {payment_id}, using email backend: {email_backend}")
    _send_payment_receipt_to_tenant(payment_id)


def _send_payment_confirmation_to_tenant(payment_id):
    """
    Internal function to send confirmation email to tenant when payment is submitted.
    """
    from .models import Payment
    
    try:
        payment = Payment.objects.select_related('tenant').get(id=payment_id)
    except Payment.DoesNotExist:
        logger.error(f"Payment with ID {payment_id} not found for confirmation email.")
        return
    
    if not payment.tenant.email:
        logger.warning(f"Tenant {payment.tenant.id} has no email address for payment confirmation.")
        return
    
    subject = f'Payment Confirmation - ${payment.amount} - {payment.type}'
    
    context = {
        'tenant_name': payment.tenant.name,
        'amount': payment.amount,
        'payment_type': payment.type,
        'payment_method': payment.method,
        'property_unit': payment.tenant.property_unit,
        'reference': payment.reference,
    }
    
    html_message = render_to_string('emails/payment_confirmation.html', context)
    plain_message = f"""
    Payment Confirmation
    
    Dear {payment.tenant.name},
    
    Your payment has been submitted and is being processed.
    
    Amount: ${payment.amount}
    Payment Type: {payment.type}
    Payment Method: {payment.method}
    Property Unit: {payment.tenant.property_unit}
    """
    
    if payment.reference:
        plain_message += f"Transaction Reference: {payment.reference}\n"
    
    plain_message += """
    You will receive a receipt via email once the payment is confirmed.
    
    Thank you,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[payment.tenant.email],
        html_message=html_message,
        email_type=f"payment confirmation email (payment {payment.id})"
    )


@shared_task
def send_payment_confirmation_to_tenant(payment_id):
    """
    Celery task to send confirmation email to tenant when payment is submitted.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_payment_confirmation_to_tenant for payment {payment_id}, using email backend: {email_backend}")
    _send_payment_confirmation_to_tenant(payment_id)


# ==================== Lease Email Functions ====================

def _send_lease_ready_for_signing(legal_document_id):
    """
    Internal function to send email to tenant when lease is generated and ready for signing.
    """
    from .models import LegalDocument
    
    try:
        legal_doc = LegalDocument.objects.select_related('tenant').get(id=legal_document_id)
    except LegalDocument.DoesNotExist:
        logger.error(f"Legal document with ID {legal_document_id} not found for lease ready email.")
        return
    
    if not legal_doc.tenant.email:
        logger.warning(f"Tenant {legal_doc.tenant.id} has no email address for lease ready email.")
        return
    
    subject = f'Lease Agreement Ready for Signing - {legal_doc.tenant.property_unit}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    signing_url = legal_doc.docusign_signing_url or f"{frontend_url.rstrip('/')}/lease-signed"
    
    context = {
        'tenant_name': legal_doc.tenant.name,
        'property_unit': legal_doc.tenant.property_unit,
        'lease_type': legal_doc.type,
        'rent_amount': legal_doc.tenant.rent_amount,
        'signing_url': signing_url,
    }
    
    html_message = render_to_string('emails/lease_ready_for_signing.html', context)
    plain_message = f"""
    Lease Ready for Signing
    
    Dear {legal_doc.tenant.name},
    
    Your lease agreement has been prepared and is ready for your review and signature.
    
    Property Unit: {legal_doc.tenant.property_unit}
    Lease Type: {legal_doc.type}
    
    Please review the lease agreement carefully and sign it using the link below:
    {signing_url}
    
    Best regards,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[legal_doc.tenant.email],
        html_message=html_message,
        email_type=f"lease ready email (document {legal_doc.id})"
    )


@shared_task
def send_lease_ready_for_signing(legal_document_id):
    """
    Celery task to send email to tenant when lease is generated and ready for signing.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_lease_ready_for_signing for document {legal_document_id}, using email backend: {email_backend}")
    _send_lease_ready_for_signing(legal_document_id)


def _send_lease_docusign_notification(legal_document_id):
    """
    Internal function to send email to tenant when DocuSign envelope is sent.
    """
    from .models import LegalDocument
    
    try:
        legal_doc = LegalDocument.objects.select_related('tenant').get(id=legal_document_id)
    except LegalDocument.DoesNotExist:
        logger.error(f"Legal document with ID {legal_document_id} not found for DocuSign notification.")
        return
    
    if not legal_doc.tenant.email:
        logger.warning(f"Tenant {legal_doc.tenant.id} has no email address for DocuSign notification.")
        return
    
    if not legal_doc.docusign_signing_url:
        logger.warning(f"Legal document {legal_doc.id} has no DocuSign signing URL.")
        return
    
    subject = f'Sign Your Lease Agreement - {legal_doc.tenant.property_unit}'
    
    context = {
        'tenant_name': legal_doc.tenant.name,
        'docusign_url': legal_doc.docusign_signing_url,
    }
    
    html_message = render_to_string('emails/lease_docusign_sent.html', context)
    plain_message = f"""
    Sign Your Lease Agreement
    
    Dear {legal_doc.tenant.name},
    
    Your lease agreement has been sent to you via DocuSign for electronic signature.
    
    Please click the link below to review and sign your lease:
    {legal_doc.docusign_signing_url}
    
    Please complete the signing process as soon as possible.
    
    Best regards,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[legal_doc.tenant.email],
        html_message=html_message,
        email_type=f"DocuSign notification email (document {legal_doc.id})"
    )


@shared_task
def send_lease_docusign_notification(legal_document_id):
    """
    Celery task to send email to tenant when DocuSign envelope is sent.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_lease_docusign_notification for document {legal_document_id}, using email backend: {email_backend}")
    _send_lease_docusign_notification(legal_document_id)


def _send_lease_signed_confirmation(legal_document_id):
    """
    Internal function to send email to tenant and manager when lease is signed.
    """
    from .models import LegalDocument
    from accounts.user_service import create_user_from_tenant, generate_password_reset_token, get_password_reset_url
    
    try:
        legal_doc = LegalDocument.objects.select_related('tenant').get(id=legal_document_id)
    except LegalDocument.DoesNotExist:
        logger.error(f"Legal document with ID {legal_document_id} not found for signed confirmation email.")
        return
    
    if not legal_doc.tenant.email:
        logger.warning(f"Tenant {legal_doc.tenant.id} has no email address for lease signed confirmation.")
        # Continue to notify admin even if tenant has no email
    
    # 1. Notify Tenant
    if legal_doc.tenant.email:
        subject = f'Lease Signed - Confirmation - {legal_doc.tenant.property_unit}'
        
        # Generate setup URL if needed
        setup_url = None
        try:
            # Ensure user exists
            user, created = create_user_from_tenant(legal_doc.tenant)
            
            # If user needs to set a password (newly created or no usable password)
            if created or not user.has_usable_password():
                token, uidb64 = generate_password_reset_token(user)
                frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
                setup_url = get_password_reset_url(uidb64, token, frontend_url)
                logger.info(f"Generated setup URL for tenant {legal_doc.tenant.id} in confirmation email")
        except Exception as e:
            logger.error(f"Error generating setup URL for tenant {legal_doc.tenant.id}: {e}")

        context = {
            'tenant_name': legal_doc.tenant.name,
            'property_unit': legal_doc.tenant.property_unit,
            'signed_date': legal_doc.signed_at or legal_doc.created_at,
            'lease_start': legal_doc.tenant.lease_start,
            'lease_end': legal_doc.tenant.lease_end,
            'signed_pdf_url': legal_doc.signed_pdf_url,
            'setup_url': setup_url,
        }
        
        html_message = render_to_string('emails/lease_signed_confirmation.html', context)
        plain_message = f"""
        Lease Signed - Confirmation
        
        Dear {legal_doc.tenant.name},
        
        Congratulations! Your lease agreement has been successfully signed.
        
        Property Unit: {legal_doc.tenant.property_unit}
        Signed Date: {legal_doc.signed_at or legal_doc.created_at}
        """
        
        if legal_doc.tenant.lease_start:
            plain_message += f"Lease Start: {legal_doc.tenant.lease_start}\n"
        if legal_doc.tenant.lease_end:
            plain_message += f"Lease End: {legal_doc.tenant.lease_end}\n"
        
        plain_message += """
        A copy of your signed lease agreement has been saved to your account.
        """
        
        if setup_url:
            plain_message += f"""
            
            To access your tenant portal and view your lease, please set up your password using the link below:
            {setup_url}
            """

        plain_message += """
        Welcome! We're excited to have you as a tenant.
        
        Best regards,
        Neela Property Management Team
        """
        
        send_email_with_logging(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[legal_doc.tenant.email],
            html_message=html_message,
            email_type=f"lease signed confirmation email (document {legal_doc.id})"
        )

    # 2. Notify Admin/Manager
    admin_emails = get_admin_emails()
    if admin_emails:
        admin_subject = f'Lease Signed - {legal_doc.tenant.name} - {legal_doc.tenant.property_unit}'
        
        admin_plain_message = f"""
        Lease Agreement Signed
        
        Tenant: {legal_doc.tenant.name}
        Property Unit: {legal_doc.tenant.property_unit}
        Signed Date: {legal_doc.signed_at or legal_doc.created_at}
        
        The signed lease document has been stored in the system.
        
        Log in to view: {getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')}
        """
        
        send_email_with_logging(
            subject=admin_subject,
            message=admin_plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            email_type=f"lease signed admin notification (document {legal_doc.id})"
        )



@shared_task
def send_lease_signed_confirmation(legal_document_id):
    """
    Celery task to send email to tenant when lease is signed.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_lease_signed_confirmation for document {legal_document_id}, using email backend: {email_backend}")
    _send_lease_signed_confirmation(legal_document_id)


# ==================== Application Decline Email Function ====================

def _send_application_declined_email_to_user(tenant_id):
    """
    Internal function to send email to user when application is declined.
    """
    from .models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        logger.error(f"Tenant with ID {tenant_id} not found for declined email.")
        return
    
    if not tenant.email:
        logger.warning(f"Tenant {tenant.id} has no email address for declined email.")
        return
    
    subject = 'Application Update - ' + tenant.property_unit
    
    context = {
        'tenant_name': tenant.name,
        'property_unit': tenant.property_unit,
        'application_date': tenant.created_at if hasattr(tenant, 'created_at') else None,
    }
    
    html_message = render_to_string('emails/application_declined.html', context)
    plain_message = f"""
    Application Update
    
    Dear {tenant.name},
    
    Thank you for your interest in {tenant.property_unit}. After careful review of your application, we regret to inform you that we are unable to proceed with your application at this time.
    
    We appreciate the time you took to submit your application. If you have any questions about this decision, please feel free to contact our office.
    
    We wish you the best in your search for housing.
    
    Best regards,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[tenant.email],
        html_message=html_message,
        email_type=f"application declined email (tenant {tenant.id})"
    )


@shared_task
def send_application_declined_email_to_user(tenant_id):
    """
    Celery task to send email to user when application is declined.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_application_declined_email_to_user for tenant {tenant_id}, using email backend: {email_backend}")
    _send_application_declined_email_to_user(tenant_id)


# ==================== Notice Email Function ====================

def _send_notice_to_tenant(legal_document_id, pdf_path=None):
    """
    Internal function to send notice email to tenant with PDF attachment.
    """
    from .models import LegalDocument
    
    try:
        legal_doc = LegalDocument.objects.select_related('tenant').get(id=legal_document_id)
    except LegalDocument.DoesNotExist:
        logger.error(f"Legal document with ID {legal_document_id} not found for notice email.")
        return
    
    if not legal_doc.tenant.email:
        logger.warning(f"Tenant {legal_doc.tenant.id} has no email address for notice email.")
        return
    
    subject = f'Legal Notice - {legal_doc.type} - {legal_doc.tenant.property_unit}'
    
    context = {
        'tenant_name': legal_doc.tenant.name,
        'notice_type': legal_doc.type,
        'property_unit': legal_doc.tenant.property_unit,
        'sent_date': legal_doc.created_at,
    }
    
    html_message = render_to_string('emails/notice_sent.html', context)
    plain_message = f"""
    Legal Notice
    
    Dear {legal_doc.tenant.name},
    
    A legal notice has been sent to you regarding your tenancy.
    
    Notice Type: {legal_doc.type}
    Property Unit: {legal_doc.tenant.property_unit}
    Date Sent: {legal_doc.created_at}
    
    A PDF copy of this notice is attached to this email. Please review it carefully and take any required action within the specified timeframe.
    
    If you have any questions about this notice, please contact the property management office immediately.
    
    Best regards,
    Neela Property Management Team
    """
    
    # Validate email configuration
    is_valid, error_msg = validate_email_config()
    if not is_valid:
        logger.error(f"Cannot send notice email: {error_msg}")
        return
    
    # Log email attempt
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Attempting to send notice email to {legal_doc.tenant.email} using {email_backend}")
    
    # Use fail_silently=False in DEBUG mode to catch errors, True in production
    fail_silently = not getattr(settings, 'DEBUG', False)
    
    try:
        email = EmailMessage(
            subject=subject,
            body=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[legal_doc.tenant.email],
        )
        email.attach_alternative(html_message, "text/html")
        
        # Attach PDF if available
        if legal_doc.pdf_file:
            try:
                email.attach_file(legal_doc.pdf_file.path)
            except Exception as e:
                logger.warning(f"Could not attach PDF to notice email: {e}")
        elif pdf_path:
            try:
                email.attach_file(pdf_path)
            except Exception as e:
                logger.warning(f"Could not attach PDF to notice email: {e}")
        
        result = email.send(fail_silently=fail_silently)
        
        if result > 0:
            logger.info(f"Notice email sent successfully to {legal_doc.tenant.email} for document {legal_doc.id} (sent {result} email(s))")
        else:
            logger.error(f"Failed to send notice email: EmailMessage.send returned {result} (0 indicates failure)")
    except Exception as e:
        logger.error(f"Error sending notice email to tenant {legal_doc.tenant.email} for document {legal_doc.id}: {e}", exc_info=True)


@shared_task
def send_notice_to_tenant(legal_document_id, pdf_path=None):
    """
    Celery task to send notice email to tenant with PDF attachment.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_notice_to_tenant for document {legal_document_id}, using email backend: {email_backend}")
    _send_notice_to_tenant(legal_document_id, pdf_path)


# ==================== Application Received Email Function ====================

def _send_application_received_email_to_tenant(tenant_id):
    """
    Internal function to send email to tenant when application is received.
    """
    from .models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        logger.error(f"Tenant with ID {tenant_id} not found for application received email.")
        return
    
    if not tenant.email:
        logger.warning(f"Tenant {tenant.id} has no email address for application received email.")
        return
    
    subject = f'Application Received - {tenant.property_unit}'
    
    context = {
        'tenant': tenant,
        'property_unit': tenant.property_unit,
    }
    
    html_message = render_to_string('emails/application_received.html', context)
    plain_message = f"""
    Application Received
    
    Dear {tenant.name},
    
    Thank you for submitting your application. We have successfully received your details and our team will review them shortly.
    
    Property Unit: {tenant.property_unit}
    Date Submitted: {tenant.created_at if hasattr(tenant, 'created_at') else 'Today'}
    Status: Under Review
    
    We will contact you if we need any additional information. You will receive another email once a decision has been made on your application.
    
    If you have any questions in the meantime, please don't hesitate to contact us.
    
    Best regards,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[tenant.email],
        html_message=html_message,
        email_type=f"application received email (tenant {tenant.id})"
    )


@shared_task
def send_application_received_email_to_tenant(tenant_id):
    """
    Celery task to send email to tenant when application is received.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_application_received_email_to_tenant for tenant {tenant_id}, using email backend: {email_backend}")
    _send_application_received_email_to_tenant(tenant_id)


# ==================== Lease Renewal Email Function ====================

def _send_lease_renewal_reminder(tenant_id, days_remaining):
    """
    Internal function to send lease renewal reminder to tenant.
    """
    from .models import Tenant
    from django.utils import timezone
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        logger.error(f"Tenant with ID {tenant_id} not found for lease renewal reminder.")
        return
    
    if not tenant.email:
        logger.warning(f"Tenant {tenant.id} has no email address for lease renewal reminder.")
        return
        
    if not tenant.lease_end:
        logger.warning(f"Tenant {tenant.id} has no lease end date for renewal reminder.")
        return
    
    subject = f'Lease Renewal Reminder - {tenant.property_unit}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    tenant_portal_url = f"{frontend_url.rstrip('/')}"
    
    context = {
        'tenant_name': tenant.name,
        'property_unit': tenant.property_unit,
        'lease_end_date': tenant.lease_end,
        'days_remaining': days_remaining,
        'tenant_portal_url': tenant_portal_url,
    }
    
    html_message = render_to_string('emails/lease_renewal_reminder.html', context)
    plain_message = f"""
    Lease Renewal Reminder
    
    Dear {tenant.name},
    
    We hope you are enjoying your stay at {tenant.property_unit}. This email is a friendly reminder that your current lease agreement is approaching its expiration date.
    
    Property Unit: {tenant.property_unit}
    Lease End Date: {tenant.lease_end}
    Days Remaining: {days_remaining}
    
    We would love to have you renew your lease with us! If you intend to renew, please contact us or visit your tenant portal to view renewal options.
    
    If you plan to vacate at the end of your lease term, please ensure you provide the required notice as outlined in your lease agreement.
    
    Please let us know your intentions as soon as possible so we can make the necessary arrangements.
    
    Best regards,
    Neela Property Management Team
    """
    
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[tenant.email],
        html_message=html_message,
        email_type=f"lease renewal reminder (tenant {tenant.id}, {days_remaining} days)"
    )


@shared_task
def send_lease_renewal_reminder(tenant_id, days_remaining):
    """
    Celery task to send lease renewal reminder to tenant.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_lease_renewal_reminder for tenant {tenant_id}, using email backend: {email_backend}")
    _send_lease_renewal_reminder(tenant_id, days_remaining)


# ==================== Admin Payment Notification Email Function ====================

def _send_payment_received_notification_to_admin(payment_id):
    """
    Internal function to send email notification to admin when payment is received/confirmed.
    """
    from .models import Payment
    
    try:
        payment = Payment.objects.select_related('tenant').get(id=payment_id)
    except Payment.DoesNotExist:
        logger.error(f"Payment with ID {payment_id} not found for admin notification.")
        return
        
    admin_emails = get_admin_emails()
    if not admin_emails:
        return
        
    subject = f'Payment Received: ${payment.amount} - {payment.tenant.name} - {payment.tenant.property_unit}'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    admin_login_url = f"{frontend_url.rstrip('/')}/admin-login"
    
    plain_message = f"""
    Payment Received
    
    A payment has been received and confirmed.
    
    Tenant: {payment.tenant.name}
    Property Unit: {payment.tenant.property_unit}
    Amount: ${payment.amount}
    Type: {payment.type}
    Date: {payment.date}
    Method: {payment.method}
    Status: {payment.status}
    
    """
    
    if payment.reference:
        plain_message += f"Reference: {payment.reference}\n"
        
    plain_message += f"""
    Log in to view details: {admin_login_url}
    """
    
    # Simple notification, no HTML template required for internal use, but could add one
    send_email_with_logging(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=admin_emails,
        email_type=f"payment received admin notification (payment {payment.id})"
    )


@shared_task
def send_payment_received_notification_to_admin(payment_id):
    """
    Celery task to send email notification to admin when payment is received/confirmed.
    """
    email_backend = getattr(settings, 'EMAIL_BACKEND', 'unknown')
    logger.info(f"Celery task executing: send_payment_received_notification_to_admin for payment {payment_id}, using email backend: {email_backend}")
    _send_payment_received_notification_to_admin(payment_id)


