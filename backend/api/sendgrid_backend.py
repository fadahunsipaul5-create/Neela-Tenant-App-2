import sendgrid
from sendgrid.helpers.mail import Mail, Email, Content, Attachment
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import sanitize_address
import logging
import base64
import mimetypes
import os

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
                to_emails = [sanitize_address(addr, message.encoding) for addr in (message.to or [])]
                subject = message.subject
                body = message.body
                if not to_emails:
                    logger.warning("SendGridBackend: message has no recipients; skipping.")
                    continue

                # Build attachments once; SendGrid Mail in this library version expects:
                # Mail(from_email=None, subject=None, to_email=None, content=None)
                # So we send one email per recipient.
                built_attachments: list[Attachment] = []
                if getattr(message, "attachments", None):
                    for attachment in message.attachments:
                        try:
                            # Django EmailMessage attachments can be tuples or MIMEBase objects
                            if hasattr(attachment, 'get_payload'):
                                filename = attachment.get_filename()
                                file_content = attachment.get_payload(decode=True)
                                file_mimetype = attachment.get_content_type()
                            elif isinstance(attachment, tuple):
                                filename, content, file_mimetype = attachment
                                if isinstance(content, str) and os.path.isfile(content):
                                    with open(content, 'rb') as f:
                                        file_content = f.read()
                                else:
                                    file_content = content.encode() if isinstance(content, str) else content
                            else:
                                continue

                            encoded = base64.b64encode(file_content).decode()
                            if not file_mimetype:
                                file_mimetype = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

                            sg_attachment = Attachment()
                            sg_attachment.content = encoded
                            sg_attachment.type = file_mimetype
                            sg_attachment.filename = filename
                            sg_attachment.disposition = 'attachment'
                            built_attachments.append(sg_attachment)
                            logger.info(f"Added attachment: {filename}")
                        except Exception as e:
                            logger.warning(f"Could not attach file: {e}")

                html_alternatives = []
                if hasattr(message, 'alternatives'):
                    html_alternatives = [(c, mt) for (c, mt) in message.alternatives if mt == "text/html"]

                for to_email in to_emails:
                    sg_mail = Mail(
                        from_email=Email(from_email),
                        subject=subject,
                        to_email=Email(to_email),
                        content=Content("text/plain", body),
                    )
                    for content, _mimetype in html_alternatives:
                        sg_mail.add_content(Content("text/html", content))

                    for att in built_attachments:
                        sg_mail.add_attachment(att)

                    # This SendGrid SDK version sends via sg.client.mail.send.post(...)
                    response = sg.client.mail.send.post(request_body=sg_mail.get())
                    if 200 <= response.status_code < 300:
                        count += 1
                        logger.info(f"Email sent successfully via SendGrid to {to_email}. Status: {response.status_code}")
                    else:
                        logger.error(f"SendGrid API Error: {response.status_code} - {response.body}")
            
            except Exception as e:
                logger.error(f"Failed to send email via SendGrid: {str(e)}", exc_info=True)
                if not self.fail_silently:
                    raise

        return count



