import { useEffect, useState, type FormEvent } from "react";

import { HealthStatus } from "../components/HealthStatus";
import { createChat, createKnowledgeBase, listDocuments, listKnowledgeBases, listMessages, sendMessage, uploadDocument, type ChatMessage, type IndexedDocument, type KnowledgeBase } from "../services/api";
import { useAuth } from "../context/AuthContext";

function useKnowledgeBases() {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const reload = () => listKnowledgeBases().then(setBases);
  useEffect(() => { void reload(); }, []);
  return { bases, reload };
}

export function DashboardPage() {
  const { user } = useAuth();
  return <div className="space-y-6"><p className="text-sm font-semibold text-indigo-600">YOUR RAG WORKSPACE</p><h1 className="text-4xl font-bold tracking-tight">Welcome back, {user?.name.split(" ")[0]}.</h1><p className="max-w-2xl text-slate-600 dark:text-slate-300">Create a knowledge base, index your documents, then ask grounded questions with source citations.</p><HealthStatus /></div>;
}

export function DocumentsPage() {
  const { bases, reload } = useKnowledgeBases();
  const [selected, setSelected] = useState(""); const [name, setName] = useState(""); const [documents, setDocuments] = useState<IndexedDocument[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (!selected && bases[0]) setSelected(bases[0].id); }, [bases, selected]);
  useEffect(() => { if (selected) void listDocuments(selected).then(setDocuments); }, [selected]);
  async function addBase(event: FormEvent) { event.preventDefault(); try { const base = await createKnowledgeBase(name); setName(""); await reload(); setSelected(base.id); } catch (e) { setError(e instanceof Error ? e.message : "Could not create knowledge base."); } }
  async function addFile(file: File) { if (!selected) return; try { await uploadDocument(selected, file); setDocuments(await listDocuments(selected)); } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); } }
  return <div className="max-w-3xl space-y-7"><div><h1 className="text-3xl font-bold">Documents</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Files are parsed and embedded in the background. Refresh to follow indexing progress.</p></div><form onSubmit={addBase} className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Knowledge base name" className="flex-1 rounded-lg border p-3 text-slate-900" /><button className="rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white">Create</button></form>{bases.length > 0 && <><select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-lg border p-3 text-slate-900">{bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}</select><label className="block cursor-pointer rounded-xl border-2 border-dashed border-indigo-300 p-8 text-center text-indigo-700"><input type="file" accept=".txt,.md,.pdf,.docx" className="hidden" onChange={(e) => e.target.files?.[0] && void addFile(e.target.files[0])} />Choose TXT, MD, PDF, or DOCX to upload</label><button onClick={() => selected && void listDocuments(selected).then(setDocuments)} className="text-sm text-indigo-600">Refresh status</button><div className="space-y-2">{documents.map((document) => <div key={document.id} className="rounded-lg border p-4"><b>{document.original_filename}</b><span className="ml-3 text-sm text-slate-500">{document.status}{document.status === "ready" ? ` · ${document.chunk_count} chunks` : ""}</span>{document.error_message && <p className="mt-1 text-sm text-rose-600">{document.error_message}</p>}</div>)}</div></>}{error && <p role="alert" className="text-rose-600">{error}</p>}</div>;
}

export function ChatPage() {
  const { bases } = useKnowledgeBases(); const [baseId, setBaseId] = useState(""); const [messages, setMessages] = useState<ChatMessage[]>([]); const [question, setQuestion] = useState(""); const [sessionId, setSessionId] = useState(""); const [error, setError] = useState(""); const [sending, setSending] = useState(false);
  useEffect(() => { if (!baseId && bases[0]) setBaseId(bases[0].id); }, [bases, baseId]);
  async function ask(event: FormEvent) { event.preventDefault(); if (!baseId || !question.trim()) return; setSending(true); try { let id = sessionId; if (!id) { const chat = await createChat(baseId); id = chat.id; setSessionId(id); } const reply = await sendMessage(id, question); setMessages((current) => [...current, reply.user_message, reply.assistant_message]); setQuestion(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not get an answer."); } finally { setSending(false); } }
  return <div className="mx-auto flex max-w-4xl flex-col gap-5"><div><h1 className="text-3xl font-bold">Grounded chat</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Answers are generated from indexed documents and include their source chunks.</p></div><select value={baseId} onChange={(e) => { setBaseId(e.target.value); setSessionId(""); setMessages([]); }} className="rounded-lg border p-3 text-slate-900"><option value="">Select a knowledge base</option>{bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}</select><section className="min-h-80 space-y-4 rounded-xl border bg-white p-5 dark:bg-slate-900">{messages.length === 0 && <p className="text-slate-500">Ask a question about your indexed documents.</p>}{messages.map((message) => <article key={message.id} className={message.role === "user" ? "ml-12 rounded-xl bg-indigo-600 p-4 text-white" : "mr-12 rounded-xl bg-slate-100 p-4 text-slate-900 dark:bg-slate-800 dark:text-white"}><p className="whitespace-pre-wrap">{message.content}</p>{message.citations.map((citation, index) => <p key={index} className="mt-3 text-xs opacity-75">Source: {citation.filename}, chunk {citation.chunk_index}</p>)}</article>)}</section><form onSubmit={ask} className="flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} disabled={!baseId || sending} placeholder="Ask about your documents…" className="flex-1 rounded-lg border p-3 text-slate-900" /><button disabled={!baseId || sending} className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white disabled:opacity-50">{sending ? "Thinking…" : "Send"}</button></form>{error && <p role="alert" className="text-rose-600">{error}</p>}</div>;
}

export const SettingsPage = () => { const { user } = useAuth(); return <div><h1 className="text-3xl font-bold">Settings</h1><p className="mt-3 text-slate-600 dark:text-slate-300">Signed in as {user?.email}.</p></div>; };
