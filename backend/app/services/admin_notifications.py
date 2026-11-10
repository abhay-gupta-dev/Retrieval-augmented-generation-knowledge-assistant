"""Optional email notifications for new accounts and anonymous guest sessions."""

from datetime import datetime, timezone
from html import escape
from email.message import EmailMessage
import json
import logging
import smtplib
import ssl
from urllib.request import Request, urlopen

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_email(recipient: str, subject: str, body: str, html_body: str | None = None) -> bool:
    """Send transactional email through Brevo's HTTPS API or configured SMTP."""
    settings = get_settings()
    if not recipient:
        logger.info("Email skipped because the recipient address is empty.")
        return False

    if settings.brevo_api_key and settings.brevo_sender_email:
        payload_data = {
            "sender": {"name": settings.brevo_sender_name, "email": settings.brevo_sender_email},
            "to": [{"email": recipient}],
            "subject": subject,
            "textContent": body,
        }
        if html_body:
            payload_data["htmlContent"] = html_body
        payload = json.dumps(payload_data).encode("utf-8")
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
            logger.info("Transactional email sent through the email API.")
            return True
        except Exception:
            logger.exception("Could not send transactional email through the email API.")
            return False

    if not (settings.smtp_host and settings.smtp_from_email):
        logger.warning("Transactional email skipped because no complete email provider is configured.")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_starttls:
                client.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
        return True
    except Exception:
        # Signup, payment processing, and guest access must survive mail outages.
        logger.exception("Could not send transactional email through SMTP.")
        return False


def send_admin_notification(subject: str, body: str) -> None:
    """Send an owner alert through the configured email provider."""
    settings = get_settings()
    if not settings.admin_notification_email:
        logger.info("Admin notification skipped because ADMIN_NOTIFICATION_EMAIL is not configured.")
        return
    send_email(settings.admin_notification_email, subject, body)


def send_customer_welcome_email(name: str, email: str) -> None:
    safe_name = escape(name or "there")
    subject = f"Welcome to Cognitive RAG, {name or 'there'}!"
    body = (
        f"Hi {name or 'there'},\n\n"
        "Welcome to Cognitive RAG. Your account is ready. You can ask questions, upload documents, "
        "and keep your conversations together in your workspace.\n\n"
        "Your account includes one free AI reply. You can review available reply plans in the app.\n\n"
        "Thanks for joining,\nThe Cognitive RAG team"
    )
    html_body = f"""<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
      <div style="max-width:600px;margin:32px auto;padding:32px;background:#fff;border-radius:16px">
        <p style="color:#2563eb;font-weight:700">✦ Cognitive RAG</p><h1 style="font-size:25px">Welcome, {safe_name}!</h1>
        <p style="line-height:1.7;color:#475569">Your account is ready. Ask questions, upload documents, and keep your conversations together in your workspace.</p>
        <p style="line-height:1.7;color:#475569">Your account includes one free AI reply. You can review available reply plans in the app.</p>
        <p style="margin-top:28px;color:#475569">Thanks for joining,<br><strong>The Cognitive RAG team</strong></p>
      </div></body></html>"""
    send_email(email, subject, body, html_body)


def send_purchase_confirmation_email(
    name: str, email: str, product_name: str, amount_inr: float, payment_id: str | None
) -> None:
    safe_name = escape(name or "there")
    safe_product = escape(product_name)
    safe_payment_id = escape(payment_id or "Confirmed")
    subject = f"Your Cognitive RAG upgrade is ready — {product_name}"
    body = (
        f"Hi {name or 'there'},\n\nCongratulations! Your {product_name} purchase is confirmed.\n"
        f"Amount: ₹{amount_inr:.2f}\nPayment reference: {payment_id or 'Confirmed'}\n\n"
        "Your new AI replies or plan are now available in Cognitive RAG.\n\n"
        "Thank you,\nThe Cognitive RAG team"
    )
    html_body = f"""<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
      <div style="max-width:600px;margin:32px auto;padding:32px;background:#fff;border-radius:16px">
        <p style="color:#2563eb;font-weight:700">✦ Cognitive RAG</p><h1 style="font-size:25px">Your upgrade is ready 🎉</h1>
        <p style="line-height:1.7;color:#475569">Hi {safe_name}, your purchase is confirmed and your replies are available in the app.</p>
        <div style="padding:16px;background:#f8fafc;border-radius:12px;line-height:1.8"><strong>{safe_product}</strong><br>Paid: ₹{amount_inr:.2f}<br><span style="font-size:12px;color:#64748b">Payment reference: {safe_payment_id}</span></div>
        <p style="margin-top:24px;color:#475569">Thank you,<br><strong>The Cognitive RAG team</strong></p>
      </div></body></html>"""
    send_email(email, subject, body, html_body)


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
