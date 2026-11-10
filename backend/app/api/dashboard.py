"""Dashboard statistics API aggregating real user metrics."""

from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.connection import get_db
from app.database.models import BillingOrder, ChatMessage, ChatSession, Document, KnowledgeBase, User
from app.schemas.rag import DashboardStatsResponse, RecentChatItem, RecentDocumentItem
from app.services.billing_service import PRODUCTS, is_owner

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/admin/overview")
def get_admin_dashboard_overview(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    """Return whole-app metrics only to the configured owner account."""
    if not is_owner(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner access required.")

    now = datetime.now(timezone.utc)
    today = now.date()
    first_day = today - timedelta(days=29)
    trend_start = datetime.combine(first_day, time.min, tzinfo=timezone.utc)

    def count(statement) -> int:
        return int(database.scalar(statement) or 0)

    def date_key(value) -> str:
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

    account_users = count(select(func.count(User.id)).where(User.provider != "guest"))
    guest_workspaces = count(select(func.count(User.id)).where(User.provider == "guest"))
    active_workspaces_30d = count(
        select(func.count(func.distinct(ChatSession.user_id))).where(ChatSession.updated_at >= trend_start)
    )
    conversations = count(select(func.count(ChatSession.id)))
    assistant_replies = count(select(func.count(ChatMessage.id)).where(ChatMessage.role == "assistant"))
    document_totals = database.execute(
        select(func.count(Document.id), func.coalesce(func.sum(Document.chunk_count), 0))
    ).one()
    paid_orders = count(select(func.count(BillingOrder.id)).where(BillingOrder.status == "paid"))
    pending_orders = count(select(func.count(BillingOrder.id)).where(BillingOrder.status == "created"))
    revenue_paise = int(database.scalar(
        select(func.coalesce(func.sum(BillingOrder.amount_paise), 0)).where(BillingOrder.status == "paid")
    ) or 0)
    revenue_30d_paise = int(database.scalar(
        select(func.coalesce(func.sum(BillingOrder.amount_paise), 0)).where(
            BillingOrder.status == "paid", BillingOrder.paid_at >= trend_start
        )
    ) or 0)
    paying_customers = count(
        select(func.count(func.distinct(BillingOrder.user_id))).where(BillingOrder.status == "paid")
    )
    active_subscribers = count(
        select(func.count(User.id)).where(
            User.provider != "guest", User.subscription_expires_at > now
        )
    )

    account_days = database.execute(
        select(func.date(User.created_at), func.count(User.id))
        .where(User.provider != "guest", User.created_at >= trend_start)
        .group_by(func.date(User.created_at))
    ).all()
    payment_days = database.execute(
        select(func.date(BillingOrder.paid_at), func.count(BillingOrder.id), func.sum(BillingOrder.amount_paise))
        .where(BillingOrder.status == "paid", BillingOrder.paid_at >= trend_start)
        .group_by(func.date(BillingOrder.paid_at))
    ).all()
    accounts_by_day = {date_key(day): int(total) for day, total in account_days}
    payments_by_day = {
        date_key(day): {"count": int(total), "revenue_inr": int(amount or 0) / 100}
        for day, total, amount in payment_days
    }
    trends = [
        {
            "date": (first_day + timedelta(days=offset)).isoformat(),
            "new_accounts": accounts_by_day.get((first_day + timedelta(days=offset)).isoformat(), 0),
            "payments": payments_by_day.get((first_day + timedelta(days=offset)).isoformat(), {}).get("count", 0),
            "revenue_inr": payments_by_day.get((first_day + timedelta(days=offset)).isoformat(), {}).get("revenue_inr", 0),
        }
        for offset in range(30)
    ]

    recent_paid_orders = database.scalars(
        select(BillingOrder)
        .where(BillingOrder.status == "paid")
        .order_by(BillingOrder.paid_at.desc())
        .limit(10)
    ).all()
    recent_payments = [
        {
            "buyer_name": order.buyer_name,
            "buyer_email": order.buyer_email,
            "product_name": PRODUCTS.get(order.product_code, {}).get("name", order.product_code),
            "amount_inr": order.amount_paise / 100,
            "payment_id": order.gateway_payment_id,
            "paid_at": order.paid_at,
        }
        for order in recent_paid_orders
    ]

    return {
        "generated_at": now,
        "registered_accounts": account_users,
        "guest_workspaces": guest_workspaces,
        "active_workspaces_30d": active_workspaces_30d,
        "accounts_created_30d": sum(item["new_accounts"] for item in trends),
        "conversations": conversations,
        "assistant_replies": assistant_replies,
        "documents": int(document_totals[0] or 0),
        "document_chunks": int(document_totals[1] or 0),
        "paid_orders": paid_orders,
        "pending_orders": pending_orders,
        "paying_customers": paying_customers,
        "active_subscribers": active_subscribers,
        "revenue_inr": revenue_paise / 100,
        "revenue_30d_inr": revenue_30d_paise / 100,
        "trends": trends,
        "recent_payments": recent_payments,
    }


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> DashboardStatsResponse:
    """Return authentic statistics, recent documents, and recent chats for the authenticated user."""
    # 1. Total knowledge bases
    total_kbs = database.scalar(
        select(func.count(KnowledgeBase.id)).where(KnowledgeBase.owner_id == user.id)
    ) or 0

    # 2. Total documents and chunks
    doc_stats = database.execute(
        select(
            func.count(Document.id),
            func.coalesce(func.sum(Document.chunk_count), 0),
        )
        .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
        .where(KnowledgeBase.owner_id == user.id)
    ).first()
    total_docs = doc_stats[0] if doc_stats else 0
    total_chunks = doc_stats[1] if doc_stats else 0

    # 3. Total chats
    total_chats = database.scalar(
        select(func.count(ChatSession.id)).where(ChatSession.user_id == user.id)
    ) or 0

    # 4. Recent documents (latest 5)
    recent_docs_rows = database.execute(
        select(Document, KnowledgeBase.name.label("kb_name"))
        .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
        .where(KnowledgeBase.owner_id == user.id)
        .order_by(Document.created_at.desc())
        .limit(5)
    ).all()

    recent_documents = [
        RecentDocumentItem(
            id=doc.id,
            original_filename=doc.original_filename,
            knowledge_base_id=doc.knowledge_base_id,
            knowledge_base_name=kb_name,
            size_bytes=doc.size_bytes,
            status=doc.status,
            chunk_count=doc.chunk_count,
            created_at=doc.created_at,
        )
        for doc, kb_name in recent_docs_rows
    ]

    # 5. Recent chats (latest 5)
    recent_chats_rows = database.execute(
        select(
            ChatSession,
            KnowledgeBase.name.label("kb_name"),
            func.count(ChatMessage.id).label("msg_count"),
        )
        .outerjoin(KnowledgeBase, KnowledgeBase.id == ChatSession.knowledge_base_id)
        .outerjoin(ChatMessage, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.user_id == user.id)
        .group_by(ChatSession.id, KnowledgeBase.name)
        .order_by(ChatSession.updated_at.desc())
        .limit(5)
    ).all()

    recent_chats = [
        RecentChatItem(
            id=chat.id,
            title=chat.title,
            knowledge_base_id=chat.knowledge_base_id,
            knowledge_base_name=kb_name,
            message_count=msg_count,
            updated_at=chat.updated_at,
        )
        for chat, kb_name, msg_count in recent_chats_rows
    ]

    return DashboardStatsResponse(
        total_knowledge_bases=total_kbs,
        total_documents=total_docs,
        total_chunks=total_chunks,
        total_chat_sessions=total_chats,
        recent_documents=recent_documents,
        recent_chats=recent_chats,
    )
