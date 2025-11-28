import sendgrid
from sendgrid.helpers.mail import Mail, Email, To, Content
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import sanitize_address
import logging

logger = logging.getLogger(__name__)

class SendGridBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently)
        self.api_key = getattr(settings, "SENDGRID_API_KEY", None)
        if not self.api_key:
            logger.error("SENDGRID_API_KEY is missing in settings.")

    def send_messages(self, email_messages):
        if not self.api_key:
            return 0

        sg = sendgrid.SendGridAPIClient(api_key=self.api_key)
        count = 0

        for message in email_messages:
            try:
                from_email = sanitize_address(message.from_email, message.encoding)
                to_emails = [sanitize_address(addr, message.encoding) for addr in message.to]
                subject = message.subject
                body = message.body
                
                # SendGrid Mail Helper
                sg_mail = Mail(
                    from_email=Email(from_email),
                    to_emails=[To(email) for email in to_emails],
                    subject=subject,
                    plain_text_content=Content("text/plain", body)
                )
                
                # Handle HTML content if present
                if hasattr(message, 'alternatives'):
                    for content, mimetype in message.alternatives:
                        if mimetype == "text/html":
                            sg_mail.add_content(Content("text/html", content))

                response = sg.send(sg_mail)
                
                if 200 <= response.status_code < 300:
                    count += 1
                    logger.info(f"Email sent successfully via SendGrid to {to_emails}. Status: {response.status_code}")
                else:
                    logger.error(f"SendGrid API Error: {response.status_code} - {response.body}")
            
            except Exception as e:
                logger.error(f"Failed to send email via SendGrid: {str(e)}", exc_info=True)
                if not self.fail_silently:
                    raise

        return count

