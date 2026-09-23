"""Comprehensive backend integration test suite covering auth, KBs, documents, and chat."""

import io
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_dev_login_and_auth_flow() -> None:
    # 1. Dev login
    login_res = client.post("/api/v1/auth/dev-login", json={"email": "tester@example.com", "name": "Test User"})
    assert login_res.status_code == 200
    user_data = login_res.json()
    assert user_data["email"] == "tester@example.com"
    assert user_data["name"] == "Test User"
    assert "access_token" in login_res.cookies

    # 2. Get current user
    me_res = client.get("/api/v1/auth/me", cookies=login_res.cookies)
    assert me_res.status_code == 200
    assert me_res.json()["id"] == user_data["id"]

    # 3. Refresh session
    refresh_res = client.post("/api/v1/auth/refresh", cookies=login_res.cookies)
    assert refresh_res.status_code == 200
    assert refresh_res.json()["id"] == user_data["id"]

    # 4. Logout
    logout_res = client.post("/api/v1/auth/logout", cookies=refresh_res.cookies)
    assert logout_res.status_code == 204


def test_knowledge_base_and_document_lifecycle() -> None:
    # Authenticate
    login_res = client.post("/api/v1/auth/dev-login", json={"email": "kb_tester@example.com", "name": "KB Tester"})
    assert login_res.status_code == 200
    cookies = login_res.cookies

    # 1. Create Knowledge Base
    create_kb_res = client.post(
        "/api/v1/knowledge-bases",
        json={"name": "Engineering Handbook", "description": "Core protocols"},
        cookies=cookies,
    )
    assert create_kb_res.status_code in (200, 201)
    kb = create_kb_res.json()
    kb_id = kb["id"]
    assert kb["name"] == "Engineering Handbook"
    assert kb["document_count"] == 0

    # 2. List Knowledge Bases
    list_kb_res = client.get("/api/v1/knowledge-bases", cookies=cookies)
    assert list_kb_res.status_code == 200
    kbs = list_kb_res.json()
    assert any(k["id"] == kb_id for k in kbs)

    # 3. Rename Knowledge Base
    update_kb_res = client.patch(
        f"/api/v1/knowledge-bases/{kb_id}",
        json={"name": "Engineering Manual Updated", "description": "Updated protocols"},
        cookies=cookies,
    )
    assert update_kb_res.status_code == 200
    assert update_kb_res.json()["name"] == "Engineering Manual Updated"

    # 4. Upload Document
    sample_content = b"# Architecture Overview\n\nThis system uses PostgreSQL and pgvector for semantic retrieval.\nFastAPI handles REST endpoints with asynchronous streaming."
    files = {"file": ("architecture.md", io.BytesIO(sample_content), "text/markdown")}
    upload_res = client.post(f"/api/v1/knowledge-bases/{kb_id}/documents", files=files, cookies=cookies)
    assert upload_res.status_code == 202
    doc = upload_res.json()
    doc_id = doc["id"]
    assert doc["original_filename"] == "architecture.md"

    # 5. Duplicate Upload Prevention (should fail with 409)
    dup_files = {"file": ("architecture.md", io.BytesIO(sample_content), "text/markdown")}
    dup_res = client.post(f"/api/v1/knowledge-bases/{kb_id}/documents", files=dup_files, cookies=cookies)
    assert dup_res.status_code == 409

    # 6. List Documents with search filter
    search_res = client.get(f"/api/v1/knowledge-bases/{kb_id}/documents?search=arch", cookies=cookies)
    assert search_res.status_code == 200
    docs = search_res.json()
    assert len(docs) == 1
    assert docs[0]["id"] == doc_id

    # 7. Delete Document
    del_doc_res = client.delete(f"/api/v1/knowledge-bases/{kb_id}/documents/{doc_id}", cookies=cookies)
    assert del_doc_res.status_code == 204

    # 8. Delete Knowledge Base
    del_kb_res = client.delete(f"/api/v1/knowledge-bases/{kb_id}", cookies=cookies)
    assert del_kb_res.status_code == 204


def test_chat_session_management_and_dashboard_stats() -> None:
    login_res = client.post("/api/v1/auth/dev-login", json={"email": "chat_tester@example.com", "name": "Chat Tester"})
    assert login_res.status_code == 200
    cookies = login_res.cookies

    # Create a KB for the chat
    kb_res = client.post(
        "/api/v1/knowledge-bases",
        json={"name": "Chat Support KB", "description": "Support docs"},
        cookies=cookies,
    )
    kb_id = kb_res.json()["id"]

    # 1. Create chat session
    create_chat_res = client.post(
        "/api/v1/chat",
        json={"knowledge_base_id": kb_id, "title": "Support Inquiry"},
        cookies=cookies,
    )
    assert create_chat_res.status_code == 201
    chat = create_chat_res.json()
    chat_id = chat["id"]
    assert chat["title"] == "Support Inquiry"
    assert chat["knowledge_base_name"] == "Chat Support KB"

    # 2. Rename chat session
    rename_res = client.patch(
        f"/api/v1/chat/{chat_id}",
        json={"title": "Renamed Support Inquiry"},
        cookies=cookies,
    )
    assert rename_res.status_code == 200
    assert rename_res.json()["title"] == "Renamed Support Inquiry"

    # 3. List messages (empty)
    msg_res = client.get(f"/api/v1/chat/{chat_id}/messages", cookies=cookies)
    assert msg_res.status_code == 200
    assert msg_res.json() == []

    # 4. Dashboard Stats
    stats_res = client.get("/api/v1/dashboard/stats", cookies=cookies)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_knowledge_bases"] >= 1
    assert stats["total_chat_sessions"] >= 1
    assert len(stats["recent_chats"]) >= 1

    # 5. Delete Chat Session
    del_chat_res = client.delete(f"/api/v1/chat/{chat_id}", cookies=cookies)
    assert del_chat_res.status_code == 204

    # Clean up KB
    client.delete(f"/api/v1/knowledge-bases/{kb_id}", cookies=cookies)
