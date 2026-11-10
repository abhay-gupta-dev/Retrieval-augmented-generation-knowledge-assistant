"""Authenticated Razorpay checkout and credit ledger endpoints."""

import json
import logging
from uuid import uuid4

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_current_user
from app.database.connection import get_db
from app.database.models import BillingOrder, User
from app.services.billing_service import PRODUCTS, apply_paid_order, entitlement_summary, is_owner, verify_checkout_signature, verify_webhook_signature
from app.services.admin_notifications import send_purchase_confirmation_email

router = APIRouter(prefix="/billing", tags=["billing"])
logger = logging.getLogger(__name__)


class CreateOrderRequest(BaseModel):
    product_code: str = Field(min_length=1, max_length=40)


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=80)
    razorpay_payment_id: str = Field(min_length=1, max_length=80)
    razorpay_signature: str = Field(min_length=1, max_length=128)


def _require_gateway_keys() -> tuple[str, str]:
    settings = get_settings()
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Online payments are not configured yet.")
    return settings.razorpay_key_id, settings.razorpay_key_secret


def _order_view(order: BillingOrder) -> dict:
    product = PRODUCTS.get(order.product_code, {})
    return {
        "id": str(order.id),
        "product_code": order.product_code,
        "product_name": product.get("name", order.product_code),
        "amount_inr": order.amount_paise / 100,
        "currency": order.currency,
        "status": order.status,
        "buyer_name": order.buyer_name,
        "buyer_email": order.buyer_email,
        "gateway_order_id": order.gateway_order_id,
        "gateway_payment_id": order.gateway_payment_id,
        "created_at": order.created_at,
        "paid_at": order.paid_at,
    }


@router.get("/me")
def billing_status(user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    summary = entitlement_summary(user)
    database.commit()  # Persist an elapsed 30-day subscription-window reset, if any.
    summary["can_purchase"] = user.provider != "guest"
    summary["razorpay_key_id"] = settings.razorpay_key_id or None
    summary["orders"] = [
        _order_view(order) for order in database.scalars(
            select(BillingOrder).where(BillingOrder.user_id == user.id).order_by(BillingOrder.created_at.desc()).limit(20)
        )
    ]
    return summary


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def create_order(
    payload: CreateOrderRequest,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    if user.provider == "guest":
        raise HTTPException(status_code=403, detail="Sign in or create an account before purchasing. This keeps your balance attached to your account.")
    product = PRODUCTS.get(payload.product_code)
    if not product:
        raise HTTPException(status_code=400, detail="Choose one of the available plans.")
    key_id, key_secret = _require_gateway_keys()
    receipt = uuid4().hex[:32]
    try:
        response = httpx.post(
            "https://api.razorpay.com/v1/orders",
            auth=(key_id, key_secret),
            json={
                "amount": product["amount_paise"],
                "currency": "INR",
                "receipt": receipt,
                "notes": {"buyer_user_id": str(user.id), "product_code": payload.product_code},
            },
            timeout=20,
        )
        response.raise_for_status()
        gateway_order = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.exception("Could not create Razorpay order")
        raise HTTPException(status_code=502, detail="Could not start checkout. Please try again shortly.") from error

    if gateway_order.get("amount") != product["amount_paise"] or gateway_order.get("currency") != "INR":
        raise HTTPException(status_code=502, detail="Payment gateway returned an invalid order.")
    order = BillingOrder(
        user_id=user.id,
        gateway_order_id=gateway_order["id"],
        product_code=payload.product_code,
        amount_paise=product["amount_paise"],
        currency="INR",
        buyer_name=user.name,
        buyer_email=user.email,
        status="created",
    )
    database.add(order)
    database.commit()
    return {
        "key_id": key_id,
        "order_id": order.gateway_order_id,
        "amount": order.amount_paise,
        "currency": order.currency,
        "name": "Cognitive RAG",
        "description": product["name"],
        "prefill": {"name": user.name, "email": user.email},
    }


@router.post("/verify")
def verify_payment(
    payload: VerifyPaymentRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    key_id, key_secret = _require_gateway_keys()
    order = database.scalar(select(BillingOrder).where(
        BillingOrder.gateway_order_id == payload.razorpay_order_id,
        BillingOrder.user_id == user.id,
    ))
    if not order:
        raise HTTPException(status_code=404, detail="Payment order not found for this account.")
    if order.status == "paid":
        return {"status": "paid", "billing": entitlement_summary(user)}
    if not verify_checkout_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment signature could not be verified.")
    try:
        response = httpx.get(
            f"https://api.razorpay.com/v1/payments/{payload.razorpay_payment_id}",
            auth=(key_id, key_secret),
            timeout=20,
        )
        response.raise_for_status()
        payment = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.exception("Could not verify Razorpay payment state")
        raise HTTPException(status_code=502, detail="Payment was received by checkout but could not yet be confirmed. Refresh your billing page shortly.") from error
    if payment.get("order_id") != order.gateway_order_id or payment.get("amount") != order.amount_paise or payment.get("currency") != order.currency:
        raise HTTPException(status_code=400, detail="Payment details do not match the order.")
    if payment.get("status") != "captured":
        raise HTTPException(status_code=409, detail="Payment is not captured yet. Your balance will update after confirmation.")
    newly_paid = apply_paid_order(database, order, payload.razorpay_payment_id)
    database.refresh(user)
    if newly_paid:
        background_tasks.add_task(
            send_purchase_confirmation_email,
            order.buyer_name,
            order.buyer_email,
            PRODUCTS[order.product_code]["name"],
            order.amount_paise / 100,
            payload.razorpay_payment_id,
        )
    return {"status": "paid", "billing": entitlement_summary(user)}


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    database: Session = Depends(get_db),
) -> dict[str, str]:
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")
    try:
        event = json.loads(raw_body)
    except (ValueError, UnicodeDecodeError) as error:
        raise HTTPException(status_code=400, detail="Invalid webhook payload.") from error
    event_name = event.get("event")
    if event_name not in {"payment.captured", "payment.failed"}:
        return {"status": "ignored"}
    payment = event.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = payment.get("order_id")
    payment_id = payment.get("id")
    if not order_id or not payment_id:
        raise HTTPException(status_code=400, detail="Captured payment is missing order details.")
    order = database.scalar(select(BillingOrder).where(BillingOrder.gateway_order_id == order_id))
    if not order:
        # Order may not be committed yet only during an unusual race; ask gateway to retry.
        raise HTTPException(status_code=503, detail="Order record is not available yet.")
    if payment.get("amount") != order.amount_paise or payment.get("currency") != order.currency:
        raise HTTPException(status_code=400, detail="Payment does not match the stored order.")
    if event_name == "payment.failed":
        if order.status != "paid":
            order.status = "failed"
            database.commit()
        return {"status": "recorded"}
    newly_paid = apply_paid_order(database, order, payment_id)
    if newly_paid:
        background_tasks.add_task(
            send_purchase_confirmation_email,
            order.buyer_name,
            order.buyer_email,
            PRODUCTS[order.product_code]["name"],
            order.amount_paise / 100,
            payment_id,
        )
    return {"status": "ok"}


@router.get("/admin/orders")
def admin_orders(user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> list[dict]:
    if not is_owner(user):
        raise HTTPException(status_code=403, detail="Owner access required.")
    orders = database.scalars(select(BillingOrder).order_by(BillingOrder.created_at.desc()).limit(500))
    return [_order_view(order) for order in orders]
