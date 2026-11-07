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
  status: "queued" | "processing" | "indexed" | "ready" | "stored" | "failed";
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
  attachment_url?: string | null;
  attachment_filename?: string | null;
  created_at: string;
};

export type SharedChat = {
  title: string;
  messages: Array<Pick<ChatMessage, "role" | "content" | "citations" | "created_at" | "attachment_filename" | "attachment_url">>;
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

const chatHistoryChangedEvent = "knowledge-platform:chat-history-changed";
export const savedChatOpenIntentKey = "knowledge-platform:open-saved-chat-once";

export function notifyChatHistoryChanged(): void {
  window.dispatchEvent(new Event(chatHistoryChangedEvent));
}

export function subscribeToChatHistoryChanges(callback: () => void): () => void {
  window.addEventListener(chatHistoryChangedEvent, callback);
  return () => window.removeEventListener(chatHistoryChangedEvent, callback);
}

// Production requests stay on the Vercel origin and are reverse-proxied to
// Render by vercel.json. This keeps the browser session cookie first-party.
// Vite's dev proxy handles local requests the same way.
const apiBaseUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "")
  : "";

export function googleLoginUrl(): string {
  // Start OAuth on the callback host itself so its state cookie is available
  // when Google returns to the registered 127.0.0.1 callback URL.
  const googleAuthBaseUrl = import.meta.env.DEV
    ? (import.meta.env.VITE_GOOGLE_AUTH_URL || "http://127.0.0.1:8000")
    : "";
  return `${googleAuthBaseUrl}/api/v1/auth/google/login`;
}

async function startGuestSession(): Promise<User> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/guest-login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === "string" ? body.detail : "";
    throw new Error(detail || `Could not start a guest session (HTTP ${response.status}).`);
  }

  return response.json() as Promise<User>;
}

let isRefreshing = false;
let refreshSubscribers: Array<(ok: boolean) => void> = [];
let refreshPromise: Promise<User> | null = null;

function onRefreshed(ok: boolean) {
  refreshSubscribers.forEach((callback) => callback(ok));
  refreshSubscribers = [];
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  isRetry = false
): Promise<T> {
  const url = `${apiBaseUrl}${path}`;
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });

  // Handle 401 with automatic token refresh and retry
  if (
    response.status === 401 &&
    !isRetry &&
    !path.includes("/auth/login") &&
    !path.includes("/auth/refresh") &&
    !path.includes("/auth/me")
  ) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        await refreshSession();

        isRefreshing = false;
        onRefreshed(true);

        return request<T>(path, init, true);
      } catch {
        try {
          await startGuestSession();
          isRefreshing = false;
          onRefreshed(true);
          return request<T>(path, init, true);
        } catch {
          isRefreshing = false;
          onRefreshed(false);
          throw new Error("Could not establish a guest session.");
        }
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
    const detail = typeof body.detail === "string"
      ? body.detail
      : Array.isArray(body.detail)
        ? body.detail.map((item: { msg?: string; loc?: (string | number)[] }) => item.msg || item.loc?.join(".") || "Invalid request").join("; ")
        : `Request failed with status ${response.status}`;
    const error = new Error(detail) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

// Authentication
export const getHealth = () => request<HealthResponse>("/health");

export const getCurrentUser = () =>
  request<User>("/api/v1/auth/me");

export const refreshSession = (): Promise<User> => {
  if (!refreshPromise) {
    refreshPromise = request<User>("/api/v1/auth/refresh", {
      method: "POST",
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export const logoutRequest = () =>
  request<void>("/api/v1/auth/logout", {
    method: "POST",
  });

export const loginRequest = (data: { email: string; password: string }) =>
  request<User>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const registerRequest = (data: { name: string; email: string; password: string }) =>
  request<User>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const devLogin = (
  email = "developer@example.com",
  name = "Developer"
) =>
  request<User>("/api/v1/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ email, name }),
  });

export const guestLogin = () =>
  startGuestSession();

// Dashboard
export const getDashboardStats = () =>
  request<DashboardStats>("/api/v1/dashboard/stats");

// Knowledge Bases
export const listKnowledgeBases = () =>
  request<KnowledgeBase[]>("/api/v1/knowledge-bases");

export const getKnowledgeBase = (id: string) =>
  request<KnowledgeBase>(`/api/v1/knowledge-bases/${id}`);

export const createKnowledgeBase = (
  name: string,
  description?: string
) =>
  request<KnowledgeBase>("/api/v1/knowledge-bases", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });

export const updateKnowledgeBase = (
  id: string,
  data: { name?: string; description?: string | null }
) =>
  request<KnowledgeBase>(`/api/v1/knowledge-bases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteKnowledgeBase = (id: string) =>
  request<void>(`/api/v1/knowledge-bases/${id}`, {
    method: "DELETE",
  });

// Documents
export const listDocuments = (
  knowledgeBaseId: string,
  search?: string
) => {
  const query = search
    ? `?search=${encodeURIComponent(search)}`
    : "";

  return request<IndexedDocument[]>(
    `/api/v1/knowledge-bases/${knowledgeBaseId}/documents${query}`
  );
};

export async function uploadDocument(
  knowledgeBaseId: string,
  file: File
): Promise<IndexedDocument> {
  const form = new FormData();
  form.append("file", file);
  return request<IndexedDocument>(
    `/api/v1/knowledge-bases/${knowledgeBaseId}/documents`,
    { method: "POST", body: form },
  );
}

export const deleteDocument = (
  knowledgeBaseId: string,
  documentId: string
) =>
  request<void>(
    `/api/v1/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`,
    {
      method: "DELETE",
    }
  );

// Chat Sessions
export const listChats = () =>
  request<ChatSession[]>("/api/v1/chat");

export const getChat = (sessionId: string) =>
  request<ChatSession>(`/api/v1/chat/${sessionId}`);

export const createChat = (
  knowledge_base_id?: string | null,
  title?: string
) =>
  request<ChatSession>("/api/v1/chat", {
    method: "POST",
    body: JSON.stringify({
      knowledge_base_id: knowledge_base_id || null,
      title,
    }),
  });

export const renameChat = (
  sessionId: string,
  title: string
) =>
  request<ChatSession>(`/api/v1/chat/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

export const attachKnowledgeBaseToChat = (
  sessionId: string,
  knowledgeBaseId: string | null,
) =>
  request<ChatSession>(`/api/v1/chat/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ knowledge_base_id: knowledgeBaseId }),
  });

export const deleteChat = (sessionId: string) =>
  request<void>(`/api/v1/chat/${sessionId}`, {
    method: "DELETE",
  });

export const createChatShare = (sessionId: string) =>
  request<{ token: string }>(`/api/v1/chat/${sessionId}/share`, { method: "POST" });

export const getSharedChat = (token: string) =>
  request<SharedChat>(`/api/v1/chat/shared?token=${encodeURIComponent(token)}`);

export const clearAllChats = () =>
  request<void>("/api/v1/chat", {
    method: "DELETE",
  });

// Chat Messages
export const listMessages = (sessionId: string) =>
  request<ChatMessage[]>(
    `/api/v1/chat/${sessionId}/messages`
  );

export const sendMessage = (
  sessionId: string,
  content: string
) =>
  request<{
    user_message: ChatMessage;
    assistant_message: ChatMessage;
  }>(`/api/v1/chat/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

export const editChatMessage = (sessionId: string, messageId: string, content: string) =>
  request<ChatMessage>(`/api/v1/chat/${sessionId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });

export const sendImage = (sessionId: string, prompt: string, documentId: string) => {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("document_id", documentId);
  return request<{
    user_message: ChatMessage;
    assistant_message: ChatMessage;
  }>(`/api/v1/chat/${sessionId}/images`, {
    method: "POST",
    body: form,
  });
};

export const retryMessage = (sessionId: string) =>
  request<{
    user_message: ChatMessage;
    assistant_message: ChatMessage;
  }>(`/api/v1/chat/${sessionId}/retry`, {
    method: "POST",
  });

// Server-Sent Events (SSE) Streaming
export async function streamChatMessage(
  sessionId: string,
  content: string,
  attachmentFilenames: string[],
  callbacks: {
    onUserMessage?: (msg: {
      id: string;
      role: string;
      content: string;
      attachment_filename?: string | null;
      created_at: string;
    }) => void;
    onCitations?: (citations: Citation[]) => void;
    onToken?: (token: string) => void;
    onDone?: (msg: ChatMessage) => void;
    onError?: (error: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const url = `${apiBaseUrl}/api/v1/chat/${sessionId}/messages/stream`;
  const init: RequestInit = {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, attachment_filenames: attachmentFilenames }),
      signal,
  };
  let response = await fetch(url, init);
  if (response.status === 401) {
    try {
      await refreshSession();
    } catch {
      await startGuestSession();
    }
    response = await fetch(url, init);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === "string" ? body.detail : "";
    throw new Error(detail || `Streaming request failed (HTTP ${response.status}).`);
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("ReadableStream not supported");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let streamError = "";
  let receivedDone = false;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n\r?\n/);
    buffer = lines.pop() ?? "";

    for (const block of lines) {
      if (!block.trim()) continue;

      const eventMatch = block.match(
        /^event:\s*(.+)$/m
      );

      const dataMatch = block.match(
        /^data:\s*(.+)$/m
      );

      if (eventMatch && dataMatch) {
        const eventType = eventMatch[1].trim();

        try {
          const data = JSON.parse(
            dataMatch[1].trim()
          );

          if (eventType === "user_message") {
            callbacks.onUserMessage?.(data);
          } else if (eventType === "citations") {
            callbacks.onCitations?.(data);
          } else if (eventType === "token") {
            callbacks.onToken?.(data.token);
          } else if (eventType === "done") {
            receivedDone = true;
            callbacks.onDone?.(data);
          } else if (eventType === "error") {
            streamError = typeof data.error === "string" ? data.error : "The assistant could not complete this response.";
            callbacks.onError?.(streamError);
          }
        } catch {
          // ignore malformed event blocks
        }
      }
    }
  }

  if (streamError) throw new Error(streamError);
  if (!receivedDone) throw new Error("The response stream ended before the answer was complete.");
}
