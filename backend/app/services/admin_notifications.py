"""Optional email notifications for new accounts and anonymous guest sessions."""

from datetime import datetime, timezone
from email.message import EmailMessage
import json
import logging
import smtplib
import ssl
from urllib.request import Request, urlopen

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_admin_notification(subject: str, body: str) -> None:
    """Send an owner alert through Brevo's HTTPS API or configured SMTP."""
    settings = get_settings()
    if not settings.admin_notification_email:
        logger.info("Admin notification skipped because ADMIN_NOTIFICATION_EMAIL is not configured.")
        return

    if settings.brevo_api_key and settings.brevo_sender_email:
        payload = json.dumps({
            "sender": {"name": settings.brevo_sender_name, "email": settings.brevo_sender_email},
            "to": [{"email": settings.admin_notification_email}],
            "subject": subject,
            "textContent": body,
        }).encode("utf-8")
        request = Request(
            "https://api.brevo.com/v3/smtp/email",
            data=payload,
            headers={
                "accept": "application/json",
                "api-key": settings.brevo_api_key,
                "content-type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=15) as response:
                if response.status >= 300:
                    raise RuntimeError(f"Brevo email API returned HTTP {response.status}.")
            logger.info("Admin notification sent through the email API.")
        except Exception:
            logger.exception("Could not send an admin notification through the email API.")
        return

    if not (settings.smtp_host and settings.smtp_from_email):
        logger.warning("Admin notification skipped because no complete email provider is configured.")
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
        logger.exception("Could not send an admin notification email through SMTP.")


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
