import type { User } from "../types/auth";

export type HealthResponse = { status: "healthy" };

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export function googleLoginUrl(): string {
  return `${apiBaseUrl}/api/v1/auth/google/login`;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "Request failed. Please try again.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const getHealth = () => request<HealthResponse>("/health");
export const getCurrentUser = () => request<User>("/api/v1/auth/me");
export const refreshSession = () => request<User>("/api/v1/auth/refresh", { method: "POST" });
export const logoutRequest = () => request<void>("/api/v1/auth/logout", { method: "POST" });

export type KnowledgeBase = { id: string; name: string; description: string | null };
export type IndexedDocument = { id: string; original_filename: string; status: string; chunk_count: number; error_message: string | null };
export type ChatSession = { id: string; knowledge_base_id: string | null; title: string };
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; citations: { filename: string; chunk_index: number; excerpt: string }[] };
export const listKnowledgeBases = () => request<KnowledgeBase[]>("/api/v1/knowledge-bases");
export const createKnowledgeBase = (name: string) => request<KnowledgeBase>("/api/v1/knowledge-bases", { method: "POST", body: JSON.stringify({ name }) });
export const listDocuments = (knowledgeBaseId: string) => request<IndexedDocument[]>(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents`);
export async function uploadDocument(knowledgeBaseId: string, file: File): Promise<IndexedDocument> {
  const form = new FormData(); form.append("file", file);
  const response = await fetch(`${apiBaseUrl}/api/v1/knowledge-bases/${knowledgeBaseId}/documents`, { method: "POST", credentials: "include", body: form });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail ?? "Upload failed.");
  return response.json();
}
export const createChat = (knowledge_base_id: string) => request<ChatSession>("/api/v1/chat", { method: "POST", body: JSON.stringify({ knowledge_base_id }) });
export const listMessages = (sessionId: string) => request<ChatMessage[]>(`/api/v1/chat/${sessionId}/messages`);
export const sendMessage = (sessionId: string, content: string) => request<{ user_message: ChatMessage; assistant_message: ChatMessage }>(`/api/v1/chat/${sessionId}/messages`, { method: "POST", body: JSON.stringify({ content }) });
