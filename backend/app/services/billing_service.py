"""Reply entitlements, Razorpay orders, and idempotent payment fulfilment."""

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.models import BillingOrder, User


PRODUCTS = {
    "reply_1": {"name": "1 AI reply", "amount_paise": 300, "tokens": 1},
    "reply_15": {"name": "15 AI replies", "amount_paise": 2000, "tokens": 15},
    "monthly": {"name": "Monthly plan", "amount_paise": 6000, "days": 30, "replies": 100},
    "six_month": {"name": "6-month plan", "amount_paise": 30000, "days": 180, "replies": 600},
}
SUBSCRIPTION_REPLY_LIMIT = 100
SUBSCRIPTION_PERIOD = timedelta(days=30)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_owner(user: User) -> bool:
    settings = get_settings()
    email = (settings.billing_owner_email or settings.admin_notification_email).strip().casefold()
    # A verified Google identity prevents someone from claiming the owner email
    # through the app's unverified email/password signup form.
    return bool(email and user.provider == "google" and user.google_id and user.email.casefold() == email)


def _roll_subscription_period(user: User, now: datetime) -> None:
    start = user.subscription_period_started_at
    if start is None or user.subscription_expires_at is None or user.subscription_expires_at <= now:
        return
    elapsed = now - start
    if elapsed >= SUBSCRIPTION_PERIOD:
        periods = int(elapsed.total_seconds() // SUBSCRIPTION_PERIOD.total_seconds())
        user.subscription_period_started_at = start + (SUBSCRIPTION_PERIOD * periods)
        user.subscription_replies_used = 0


def entitlement_summary(user: User) -> dict:
    now = utc_now()
    _roll_subscription_period(user, now)
    subscription_active = bool(user.subscription_expires_at and user.subscription_expires_at > now)
    return {
        "is_owner": is_owner(user),
        "free_replies_remaining": max(0, 1 - user.free_replies_used),
        "token_balance": user.token_balance,
        "subscription_active": subscription_active,
        "subscription_expires_at": user.subscription_expires_at,
        "subscription_replies_remaining": (
            max(0, SUBSCRIPTION_REPLY_LIMIT - user.subscription_replies_used) if subscription_active else 0
        ),
    }


def reserve_reply(database: Session, user: User) -> str:
    """Atomically reserve one answer credit and return its source for refunds."""
    if is_owner(user):
        return "owner"
    locked_user = database.scalar(select(User).where(User.id == user.id).with_for_update())
    if not locked_user:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    now = utc_now()
    _roll_subscription_period(locked_user, now)
    if locked_user.free_replies_used < 1:
        locked_user.free_replies_used += 1
        source = "free"
    elif locked_user.subscription_expires_at and locked_user.subscription_expires_at > now and locked_user.subscription_replies_used < SUBSCRIPTION_REPLY_LIMIT:
        locked_user.subscription_replies_used += 1
        source = "subscription"
    elif locked_user.token_balance > 0:
        locked_user.token_balance -= 1
        source = "token"
    else:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="You have used your free AI reply. Choose a reply pack or subscription to continue.",
        )
    database.commit()
    return source


def refund_reply_reservation(user_id, source: str) -> None:
    if source == "owner":
        return
    from app.database.connection import SessionLocal

    with SessionLocal() as database:
        user = database.scalar(select(User).where(User.id == user_id).with_for_update())
        if not user:
            return
        if source == "free":
            user.free_replies_used = max(0, user.free_replies_used - 1)
        elif source == "token":
            user.token_balance += 1
        elif source == "subscription":
            user.subscription_replies_used = max(0, user.subscription_replies_used - 1)
        database.commit()


def apply_paid_order(database: Session, order: BillingOrder, payment_id: str) -> bool:
    """Grant purchased entitlement once. Caller has already verified gateway payment."""
    locked_order = database.scalar(
        select(BillingOrder).where(BillingOrder.id == order.id).with_for_update()
    )
    if not locked_order:
        return False
    if locked_order.status == "paid":
        return False
    user = database.scalar(select(User).where(User.id == locked_order.user_id).with_for_update())
    if not user:
        raise HTTPException(status_code=404, detail="Purchasing account no longer exists.")
    product = PRODUCTS.get(locked_order.product_code)
    if not product:
        raise HTTPException(status_code=409, detail="Unknown product attached to this payment order.")
    now = utc_now()
    if "tokens" in product:
        user.token_balance += product["tokens"]
    else:
        current_expiry = user.subscription_expires_at
        if current_expiry and current_expiry > now:
            if user.subscription_period_started_at is None:
                user.subscription_period_started_at = now
            user.subscription_expires_at = current_expiry + timedelta(days=product["days"])
        else:
            user.subscription_period_started_at = now
            user.subscription_replies_used = 0
            user.subscription_expires_at = now + timedelta(days=product["days"])
    locked_order.gateway_payment_id = payment_id
    locked_order.status = "paid"
    locked_order.paid_at = now
    database.commit()
    return True


def verify_checkout_signature(order_id: str, payment_id: str, signature: str) -> bool:
    secret = get_settings().razorpay_key_secret
    expected = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    secret = get_settings().razorpay_webhook_secret
    if not secret:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
