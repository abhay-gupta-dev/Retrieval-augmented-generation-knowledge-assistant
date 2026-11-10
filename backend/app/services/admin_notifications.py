"""Optional email notifications for new accounts and anonymous guest sessions."""

from datetime import datetime, timezone
from email.message import EmailMessage
import logging
import smtplib
import ssl

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_admin_notification(subject: str, body: str) -> None:
    """Send an owner alert when SMTP notification settings are configured."""
    settings = get_settings()
    required = (
        settings.admin_notification_email,
        settings.smtp_host,
        settings.smtp_from_email,
    )
    if not all(required):
        logger.info("Admin notification skipped because SMTP notification settings are incomplete.")
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = settings.admin_notification_email
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_starttls:
                client.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
    except Exception:
        # Signup and guest access should continue even when the mail provider is down.
        logger.exception("Could not send an admin notification email.")


def account_signup_notification(name: str, email: str, provider: str) -> tuple[str, str]:
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return (
        "New Cognitive RAG account",
        f"A new account was created.\n\nName: {name}\nEmail: {email}\nSign-in method: {provider}\nCreated at: {created_at}\n",
    )


def guest_session_notification() -> tuple[str, str]:
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return (
        "New Cognitive RAG guest session",
        "A new anonymous guest workspace was started. Guest mode does not provide a real name or email address.\n\n"
        f"Started at: {created_at}\n",
    )
