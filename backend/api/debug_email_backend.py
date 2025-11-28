import smtplib
import logging
from django.core.mail.backends.smtp import EmailBackend

logger = logging.getLogger(__name__)

class DebugEmailBackend(EmailBackend):
    def open(self):
        logger.info(f"DebugEmailBackend.open() called. Host={self.host}, Port={self.port}, TLS={self.use_tls}, SSL={self.use_ssl}")
        if self.connection:
            return False

        try:
            if self.use_ssl:
                logger.info("Initializing SMTP_SSL connection...")
                self.connection = smtplib.SMTP_SSL(self.host, self.port, timeout=self.timeout)
            else:
                logger.info("Initializing SMTP connection...")
                self.connection = smtplib.SMTP(self.host, self.port, timeout=self.timeout)

            logger.info("Connection established. Enabling debuglevel=2")
            self.connection.set_debuglevel(2)

            if self.use_tls:
                logger.info("Starting TLS...")
                self.connection.starttls(keyfile=self.ssl_keyfile, certfile=self.ssl_certfile)
                logger.info("TLS started.")

            if self.username and self.password:
                logger.info(f"Attempting login for user: {self.username}")
                self.connection.login(self.username, self.password)
                logger.info("Login successful.")

            return True
        except Exception as e:
            logger.error(f"DebugEmailBackend.open() FAILED: {e}", exc_info=True)
            if not self.fail_silently:
                raise
            return False

    def _send(self, email_message):
        logger.info(f"Preparing to send email to: {email_message.recipients()}")
        if not email_message.recipients():
            return False
        try:
            return super()._send(email_message)
        except Exception as e:
            logger.error(f"DebugEmailBackend._send() FAILED: {e}", exc_info=True)
            if not self.fail_silently:
                raise
            return False
