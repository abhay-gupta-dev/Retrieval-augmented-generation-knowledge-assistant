import type { User } from "../types/auth";

export type HealthResponse = { status: "healthy" };

export type Citation = {
  document_id: string;
  filename: string;
  chunk_index: number;
  excerpt: string;
};

export type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
  total_chunks: number;
};

export type IndexedDocument = {
  id: string;
  knowledge_base_id: string;
  original_filename: string;
  content_type: string | null;
  size_bytes: number;
  status: "queued" | "processing" | "indexed" | "ready" | "failed";
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  indexed_at: string | null;
};

export type ChatSession = {
  id: string;
  knowledge_base_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  knowledge_base_name?: string | null;
  message_count: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
};

export type RecentDocumentItem = {
  id: string;
  original_filename: string;
  knowledge_base_id: string;
  knowledge_base_name: string;
  size_bytes: number;
  status: string;
  chunk_count: number;
  created_at: string;
};

export type RecentChatItem = {
  id: string;
  title: string;
  knowledge_base_id: string | null;
  knowledge_base_name: string | null;
  message_count: number;
  updated_at: string;
};

export type DashboardStats = {
  total_knowledge_bases: number;
  total_documents: number;
  total_chunks: number;
  total_chat_sessions: number;
  recent_documents: RecentDocumentItem[];
  recent_chats: RecentChatItem[];
};

// Use matching hostname (localhost vs 127.0.0.1) to eliminate cross-origin cookie issues
const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
const defaultBaseUrl = host === "127.0.0.1" ? "http://127.0.0.1:8000" : "http://localhost:8000";
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl).replace(/\/$/, "");

export function googleLoginUrl(): string {
  return `${apiBaseUrl}/api/v1/auth/google/login`;
}

let isRefreshing = false;
let refreshSubscribers: Array<(ok: boolean) => void> = [];

function onRefreshed(ok: boolean) {
  refreshSubscribers.forEach((callback) => callback(ok));
  refreshSubscribers = [];
}

export async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  // Handle 401 with automatic token refresh and retry
  if (response.status === 401 && !isRetry && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        await refreshSession();
        isRefreshing = false;
        onRefreshed(true);
        return request<T>(path, init, true);
      } catch {
        isRefreshing = false;
        onRefreshed(false);
        throw new Error("Session expired. Please sign in again.");
      }
    } else {
      // Wait for ongoing refresh
      const ok = await new Promise<boolean>((resolve) => {
        refreshSubscribers.push(resolve);
      });
      if (ok) {
        return request<T>(path, init, true);
      } else {
        throw new Error("Session expired. Please sign in again.");
      }
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// Authentication
export const getHealth = () => request<HealthResponse>("/health");
export const getCurrentUser = () => request<User>("/api/v1/auth/me");
export const refreshSession = () => request<User>("/api/v1/auth/refresh", { method: "POST" });
export const logoutRequest = () => request<void>("/api/v1/auth/logout", { method: "POST" });
export const devLogin = (email = "developer@example.com", name = "Developer") =>
  request<User>("/api/v1/auth/dev-login", { method: "POST", body: JSON.stringify({ email, name }) });

// Dashboard
export const getDashboardStats = () => request<DashboardStats>("/api/v1/dashboard/stats");

// Knowledge Bases
export const listKnowledgeBases = () => request<KnowledgeBase[]>("/api/v1/knowledge-bases");
export const getKnowledgeBase = (id: string) => request<KnowledgeBase>(`/api/v1/knowledge-bases/${id}`);
export const createKnowledgeBase = (name: string, description?: string) =>
  request<KnowledgeBase>("/api/v1/knowledge-bases", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
export const updateKnowledgeBase = (id: string, data: { name?: string; description?: string | null }) =>
  request<KnowledgeBase>(`/api/v1/knowledge-bases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const deleteKnowledgeBase = (id: string) =>
  request<void>(`/api/v1/knowledge-bases/${id}`, { method: "DELETE" });

// Documents
export const listDocuments = (knowledgeBaseId: string, search?: string) => {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<IndexedDocument[]>(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents${query}`);
};

export async function uploadDocument(knowledgeBaseId: string, file: File): Promise<IndexedDocument> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiBaseUrl}/api/v1/knowledge-bases/${knowledgeBaseId}/documents`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "Upload failed.");
  }
  return response.json();
}

export const deleteDocument = (knowledgeBaseId: string, documentId: string) =>
  request<void>(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`, { method: "DELETE" });

// Chat Sessions
export const listChats = () => request<ChatSession[]>("/api/v1/chat");
export const getChat = (sessionId: string) => request<ChatSession>(`/api/v1/chat/${sessionId}`);
export const createChat = (knowledge_base_id?: string | null, title?: string) =>
  request<ChatSession>("/api/v1/chat", {
    method: "POST",
    body: JSON.stringify({ knowledge_base_id: knowledge_base_id || null, title }),
  });
export const renameChat = (sessionId: string, title: string) =>
  request<ChatSession>(`/api/v1/chat/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
export const deleteChat = (sessionId: string) =>
  request<void>(`/api/v1/chat/${sessionId}`, { method: "DELETE" });

// Chat Messages
export const listMessages = (sessionId: string) =>
  request<ChatMessage[]>(`/api/v1/chat/${sessionId}/messages`);

export const sendMessage = (sessionId: string, content: string) =>
  request<{ user_message: ChatMessage; assistant_message: ChatMessage }>(
    `/api/v1/chat/${sessionId}/messages`,
    { method: "POST", body: JSON.stringify({ content }) }
  );

export const retryMessage = (sessionId: string) =>
  request<{ user_message: ChatMessage; assistant_message: ChatMessage }>(
    `/api/v1/chat/${sessionId}/retry`,
    { method: "POST" }
  );

// Server-Sent Events (SSE) Streaming
export async function streamChatMessage(
  sessionId: string,
  content: string,
  callbacks: {
    onUserMessage?: (msg: { id: string; role: string; content: string; created_at: string }) => void;
    onCitations?: (citations: Citation[]) => void;
    onToken?: (token: string) => void;
    onDone?: (msg: ChatMessage) => void;
    onError?: (error: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/v1/chat/${sessionId}/messages/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "Streaming request failed");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("ReadableStream not supported");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const block of lines) {
      if (!block.trim()) continue;
      const eventMatch = block.match(/^event:\s*(.+)$/m);
      const dataMatch = block.match(/^data:\s*(.+)$/m);

      if (eventMatch && dataMatch) {
        const eventType = eventMatch[1].trim();
        try {
          const data = JSON.parse(dataMatch[1].trim());
          if (eventType === "user_message") {
            callbacks.onUserMessage?.(data);
          } else if (eventType === "citations") {
            callbacks.onCitations?.(data);
          } else if (eventType === "token") {
            callbacks.onToken?.(data.token);
          } else if (eventType === "done") {
            callbacks.onDone?.(data);
          } else if (eventType === "error") {
            callbacks.onError?.(data.error);
          }
        } catch {
          // ignore malformed event blocks
        }
      }
    }
  }
}
