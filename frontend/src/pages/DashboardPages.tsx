import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Copy, FileText, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { HealthStatus } from "../components/HealthStatus";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { VoiceInputButton, VoiceSpeakerButton } from "../components/VoiceControls";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};
import { attachKnowledgeBaseToChat, createChat, createKnowledgeBase, deleteDocument, getDashboardStats, listChats, listDocuments, listKnowledgeBases, listMessages, notifyChatHistoryChanged, retryMessage, sendImage, sendMessage, streamChatMessage, uploadDocument, type ChatMessage, type DashboardStats, type IndexedDocument, type KnowledgeBase } from "../services/api";
import { useAuth } from "../context/AuthContext";

function useKnowledgeBases() {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const reload = () => listKnowledgeBases().then(setBases);
  useEffect(() => { void reload(); }, []);
  return { bases, reload };
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null); const [error, setError] = useState("");
  useEffect(() => { void getDashboardStats().then(setStats).catch((e) => setError(e instanceof Error ? e.message : "Could not load workspace stats.")); }, []);
  const metrics = stats ? [["Knowledge bases", stats.total_knowledge_bases, "Organize your sources"], ["Indexed documents", stats.total_documents, "Ready for retrieval"], ["Stored chunks", stats.total_chunks, "Semantic context"], ["Conversations", stats.total_chat_sessions, "Your recent thinking"]] : [];
  return <div className="space-y-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Your private workspace</p><h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Welcome back, {user?.name.split(" ")[0]}.</h1><p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Bring your documents into focus, then ask grounded questions with the sources close at hand.</p></div><HealthStatus /></div>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.length ? metrics.map(([label, value, hint]) => <div key={label} className="surface rounded-2xl p-5"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{value}</p><p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-teal-700 dark:text-teal-300">{hint}</p></div>) : [1, 2, 3, 4].map((item) => <div key={item} className="surface animate-pulse rounded-2xl p-5"><div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" /><div className="mt-4 h-9 w-14 rounded bg-slate-200 dark:bg-slate-700" /><div className="mt-3 h-3 w-28 rounded bg-slate-200 dark:bg-slate-700" /></div>)}</div><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="surface rounded-2xl p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Recent documents</p><h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Your knowledge base</h2></div><a href="/documents" className="text-sm font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-300">Manage files →</a></div>{stats?.recent_documents.length ? <div className="mt-6 space-y-3">{stats.recent_documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-4 rounded-xl bg-[#f1f6f2] p-3 dark:bg-white/5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{document.original_filename}</p><p className="mt-1 text-xs text-slate-500">{document.knowledge_base_name} · {document.chunk_count} chunks</p></div><span className="shrink-0 text-xs font-semibold text-teal-700 dark:text-teal-300">{document.status}</span></div>)}</div> : <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">No documents yet. Upload a file to start building context.</p>}</div><div className="rounded-2xl bg-[#163a32] p-6 text-[#e0f1e9]"><p className="text-sm font-semibold text-teal-200">Start a focused session</p><h2 className="mt-2 text-2xl font-bold">Ask better questions of your own material.</h2><p className="mt-3 text-sm leading-6 text-[#b9d1c6]">Create a conversation, choose a knowledge base, and keep every answer anchored to your sources.</p><a href="/chat" className="mt-6 inline-flex rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-[#102522] transition hover:bg-teal-200">Open chat <span className="ml-2" aria-hidden="true">→</span></a></div></div></div>;
}

export function DocumentsPage() {
  const { bases, reload } = useKnowledgeBases();
  const [selected, setSelected] = useState(""); const [name, setName] = useState(""); const [documents, setDocuments] = useState<IndexedDocument[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { if (!selected && bases[0]) setSelected(bases[0].id); }, [bases, selected]);
  useEffect(() => { if (selected) { setLoading(true); void listDocuments(selected).then(setDocuments).catch((e) => setError(e instanceof Error ? e.message : "Could not load documents.")).finally(() => setLoading(false)); } }, [selected]);
  async function addBase(event: FormEvent) { event.preventDefault(); setError(""); try { const base = await createKnowledgeBase(name); setName(""); await reload(); setSelected(base.id); } catch (e) { setError(e instanceof Error ? e.message : "Could not create knowledge base."); } }
  async function addFile(file: File) { if (!selected) return; setError(""); try { await uploadDocument(selected, file); setDocuments(await listDocuments(selected)); } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); } }
  return <div className="space-y-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Knowledge</p><h1 className="text-3xl font-bold text-slate-950 dark:text-white">Documents</h1><p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">Upload source material, let it index in the background, then use it in grounded conversations.</p></div>{bases.length > 0 && <select aria-label="Select knowledge base" value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-xl border border-[#cbdcd4] bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm dark:border-[#28413a] dark:bg-[#14231f] dark:text-white">{bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}</select>}</div><div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><section className="surface rounded-2xl p-6"><p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Create a collection</p><h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">Start with a knowledge base</h2><form onSubmit={addBase} className="mt-5 space-y-3"><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Product handbook" className="w-full rounded-xl border border-[#cbdcd4] bg-white p-3 text-slate-900 outline-none focus:border-teal-500 dark:border-[#28413a] dark:bg-[#14231f] dark:text-white" /><button type="submit" className="w-full rounded-xl bg-[#163a32] px-4 py-3 font-semibold text-white transition hover:bg-[#1d4b40]">Create knowledge base</button></form><div className="mt-6 rounded-xl bg-[#eef6f1] p-4 text-sm leading-6 text-slate-600 dark:bg-white/5 dark:text-slate-300">Supported files: TXT, Markdown, PDF, and DOCX. Processing happens privately in the background.</div></section>{bases.length > 0 ? <section className="surface rounded-2xl p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700 dark:text-teal-300">{documents.length} source{documents.length === 1 ? "" : "s"}</p><h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{bases.find((base) => base.id === selected)?.name}</h2></div><button type="button" onClick={() => selected && void listDocuments(selected).then(setDocuments)} className="rounded-lg px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-white/5">Refresh</button></div><label className="mt-5 block cursor-pointer rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/50 p-7 text-center transition hover:bg-teal-50 dark:border-teal-800 dark:bg-teal-950/20 dark:hover:bg-teal-950/40"><input type="file" accept=".txt,.md,.pdf,.docx" className="hidden" onChange={(e) => e.target.files?.[0] && void addFile(e.target.files[0])} /><span className="text-2xl" aria-hidden="true">↑</span><span className="mt-2 block font-semibold text-teal-900 dark:text-teal-200">Add a document</span><span className="mt-1 block text-sm text-teal-700/70 dark:text-teal-300/70">Choose a file to upload and index</span></label>{loading ? <div className="mt-6 space-y-3">{[1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}</div> : documents.length ? <div className="mt-6 space-y-3">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#dce7e0] p-4 dark:border-[#28413a]"><div className="min-w-0"><p className="truncate font-semibold text-slate-800 dark:text-slate-100">{document.original_filename}</p><p className="mt-1 text-xs text-slate-500">{document.size_bytes.toLocaleString()} bytes{document.status === "indexed" ? ` · ${document.chunk_count} chunks` : ""}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${document.status === "indexed" ? "bg-emerald-100 text-emerald-800" : document.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{document.status}</span>{document.error_message && <p className="text-sm text-rose-600">{document.error_message}</p>}</div>)}</div> : <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">No documents in this collection yet.</p>}</section> : <section className="surface flex min-h-64 items-center justify-center rounded-2xl p-8 text-center"><div><p className="text-3xl" aria-hidden="true">▤</p><h2 className="mt-3 text-xl font-bold text-slate-950 dark:text-white">Your sources will appear here</h2><p className="mt-2 text-sm text-slate-500">Create a knowledge base to unlock document uploads.</p></div></section>}</div>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}</div>;
}

export function ChatPage() {
  const { user } = useAuth();
  const { reload } = useKnowledgeBases();
  const [searchParams] = useSearchParams();
  const requestedChatId = searchParams.get("chat");
  const newChatRequested = searchParams.get("new") === "1";
  const [baseId, setBaseId] = useState("");
  const [chatFiles, setChatFiles] = useState<IndexedDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [removingFileId, setRemovingFileId] = useState("");
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imagePreviewUrls = useRef<string[]>([]);

  useEffect(() => () => {
    imagePreviewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (newChatRequested) {
      startNewChat();
      return;
    }
    void listChats()
      .then(async (chats) => {
        const targetChat = requestedChatId
          ? chats.find((chat) => chat.id === requestedChatId)
          : chats[0];
        if (requestedChatId && !targetChat) {
          setError("That saved chat could not be found.");
          setSessionId("");
          setBaseId("");
          setMessages([]);
          return;
        }
        if (!targetChat) {
          setSessionId("");
          setBaseId("");
          setMessages([]);
          return;
        }
        setSessionId(targetChat.id);
        setBaseId(targetChat.knowledge_base_id ?? "");
        setMessages(await listMessages(targetChat.id));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your latest conversation."));
  }, [newChatRequested, requestedChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    let active = true;
    if (!baseId) {
      setChatFiles([]);
      return () => { active = false; };
    }
    void listDocuments(baseId)
      .then((items) => { if (active) setChatFiles(items); })
      .catch(() => { if (active) setChatFiles([]); });
    return () => { active = false; };
  }, [baseId]);

  function startNewChat() {
    setSessionId("");
    setBaseId("");
    setChatFiles([]);
    setMessages([]);
    setQuestion("");
    setError("");
    setNotice("");
    setPendingAttachments((current) => {
      current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
      return [];
    });
  }

  function stageAttachments(files: File[]) {
    const attachments = files.map((file) => {
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (previewUrl) imagePreviewUrls.current.push(previewUrl);
      return { id: crypto.randomUUID(), file, previewUrl };
    });
    setPendingAttachments((current) => [...current, ...attachments]);
    setError("");
    setNotice("");
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) => {
      const attachment = current.find((item) => item.id === id);
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? "" : current), 1800);
    } catch {
      setError("Could not copy this message. Check your browser clipboard permissions.");
    }
  }

  async function removeChatFile(file: IndexedDocument) {
    if (!baseId || !window.confirm(`Remove “${file.original_filename}” from this chat? This deletes the uploaded file and its indexed content.`)) return;
    setRemovingFileId(file.id);
    setError("");
    try {
      await deleteDocument(baseId, file.id);
      setChatFiles((current) => current.filter((item) => item.id !== file.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove the uploaded file.");
    } finally {
      setRemovingFileId("");
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    const attachments = [...pendingAttachments];
    const imageAttachments = attachments.filter((attachment) => attachment.file.type.startsWith("image/"));
    const documentAttachments = attachments.filter((attachment) => !attachment.file.type.startsWith("image/"));
    const prompt = question.trim() || (imageAttachments.length
      ? "Describe the attached image and explain its important details."
      : documentAttachments.length ? "Please summarize the attached document." : "");
    if ((!prompt && attachments.length === 0) || sending) return;

    setSending(true);
    setError("");
    setNotice("");
    try {
      let activeSessionId = sessionId;
      let activeKnowledgeBaseId = baseId;
      if (documentAttachments.length > 0 && !activeKnowledgeBaseId) {
        const base = await createKnowledgeBase(`Chat files ${Date.now()}`, "Files uploaded from this conversation");
        activeKnowledgeBaseId = base.id;
        setBaseId(base.id);
        await reload();
      }
      if (!activeSessionId) {
        const chat = await createChat(activeKnowledgeBaseId || null);
        activeSessionId = chat.id;
        setSessionId(chat.id);
        if (newChatRequested) {
          window.history.replaceState(window.history.state, "", "/chat");
        }
        notifyChatHistoryChanged();
      } else if (documentAttachments.length > 0 && activeKnowledgeBaseId && activeKnowledgeBaseId !== baseId) {
        await attachKnowledgeBaseToChat(activeSessionId, activeKnowledgeBaseId);
      }

      if (documentAttachments.length > 0 && activeKnowledgeBaseId) {
        setUploading(true);
        for (const attachment of documentAttachments) {
          setNotice(`Uploading ${attachment.file.name}…`);
          const uploaded = await uploadDocument(activeKnowledgeBaseId, attachment.file);
          setChatFiles((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
          setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
          setIndexing(true);
          setNotice(`Preparing ${attachment.file.name}…`);
          let ready = false;
          for (let attempt = 0; attempt < 60; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 2000));
            try {
              const documents = await listDocuments(activeKnowledgeBaseId);
              setChatFiles(documents);
              const current = documents.find((document) => document.id === uploaded.id);
              if (current?.status === "failed") {
                throw new Error(current.error_message || `We could not process ${attachment.file.name}.`);
              }
              if (current?.status === "indexed" || current?.status === "ready") {
                ready = true;
                break;
              }
            } catch (cause) {
              if (cause instanceof Error && cause.message !== "Failed to fetch") throw cause;
            }
          }
          if (!ready) throw new Error(`${attachment.file.name} is still processing. Please try sending your message again in a moment.`);
        }
        setUploading(false);
        setIndexing(false);
      }

      if (imageAttachments.length > 0) {
        for (const attachment of imageAttachments) {
          setNotice(`Analyzing ${attachment.file.name}…`);
          const reply = await sendImage(activeSessionId, prompt, attachment.file);
          let previewUrl = attachment.previewUrl;
          if (!previewUrl) {
            previewUrl = URL.createObjectURL(attachment.file);
            imagePreviewUrls.current.push(previewUrl);
          }
          setImagePreviews((current) => ({ ...current, [reply.user_message.id]: previewUrl! }));
          setMessages((current) => [...current, reply.user_message, reply.assistant_message]);
          setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
          notifyChatHistoryChanged();
        }
        if (documentAttachments.length === 0) {
          setQuestion("");
          setNotice("");
          return;
        }
      }

      // General questions do not need the document retrieval or SSE pipeline.
      // Use the regular chat endpoint unless this conversation has an attached
      // knowledge base, which opts into document-grounded answers.
      if (!activeKnowledgeBaseId) {
        const reply = await sendMessage(activeSessionId, prompt);
        setQuestion("");
        setPendingAttachments([]);
        setNotice("");
        setMessages((current) => [...current, reply.user_message, reply.assistant_message]);
        notifyChatHistoryChanged();
        return;
      }

      let streamedText = "";
      let streamedCitations: ChatMessage["citations"] = [];
      let userMessageAccepted = false;
      try {
        await streamChatMessage(activeSessionId, prompt, {
          onUserMessage: (message) => {
            userMessageAccepted = true;
            setQuestion("");
            setPendingAttachments([]);
            setMessages((current) => [...current, { ...message, role: "user", citations: [] } as ChatMessage]);
            notifyChatHistoryChanged();
          },
          onCitations: (citations) => {
            streamedCitations = citations;
          },
          onToken: (token) => {
            streamedText += token;
            const partial: ChatMessage = {
              id: `stream-${activeSessionId}`,
              role: "assistant",
              content: streamedText,
              citations: streamedCitations,
              created_at: new Date().toISOString(),
            };
            setMessages((current) => current.at(-1)?.id === partial.id
              ? [...current.slice(0, -1), partial]
              : [...current, partial]);
          },
          onDone: (message) => {
            const complete: ChatMessage = { ...message, citations: message.citations ?? streamedCitations };
            setMessages((current) => current.at(-1)?.id === `stream-${activeSessionId}`
              ? [...current.slice(0, -1), complete]
              : [...current, complete]);
            notifyChatHistoryChanged();
          },
        });
      } catch {
        // Recover from SSE/proxy failures without duplicating a user message
        // that the streaming endpoint has already saved.
        const reply = userMessageAccepted
          ? await retryMessage(activeSessionId)
          : await sendMessage(activeSessionId, prompt);
        setError("");
        setQuestion("");
        setPendingAttachments([]);
        setMessages((current) => {
          const withoutPartial = current.filter((message) => message.id !== `stream-${activeSessionId}`);
          return userMessageAccepted
            ? [...withoutPartial, reply.assistant_message]
            : [...withoutPartial, reply.user_message, reply.assistant_message];
        });
        notifyChatHistoryChanged();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not get an answer.");
    } finally {
      setUploading(false);
      setIndexing(false);
      setSending(false);
      setNotice("");
    }
  }

  return <div className="mx-auto flex h-full min-h-0 w-full max-w-none flex-col gap-2 max-[380px]:pt-4">
    <section className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3 sm:p-6" aria-live="polite">
      {messages.length === 0 && <div className="flex min-h-64 items-center justify-center text-center"><div>
        <p className="text-4xl" aria-hidden="true">✦</p>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{user?.provider === "guest" ? "Welcome to Cognitive RAG!" : `Welcome${user?.name ? `, ${user.name.trim().split(/\s+/)[0]}` : ""}!`}</h2>
        <p className="mt-2 text-base font-medium text-slate-700 dark:text-slate-200">How can I help you today?</p>
      </div></div>}
      {messages.map((message) => <article key={message.id} className={`w-full break-words ${message.role === "user" ? "ml-auto max-w-[95%] rounded-2xl bg-[#163a32] p-4 text-white sm:max-w-[78%] sm:p-5" : "mr-auto max-w-full py-1 text-slate-900 dark:text-white"}`}>
        {message.role === "user" && imagePreviews[message.id] && <img src={imagePreviews[message.id]} alt="Image attached to this message" className="mb-3 max-h-72 max-w-full rounded-xl object-contain" />}
        {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</p>}
        {message.citations.length > 0 && <div className="mt-4 border-t border-current/10 pt-3">{message.citations.map((citation) => <p key={`${citation.document_id}-${citation.chunk_index}`} className="text-xs opacity-70">Source: {citation.filename}</p>)}</div>}
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => void copyMessage(message)} aria-label={copiedMessageId === message.id ? "Message copied" : "Copy message"} title={copiedMessageId === message.id ? "Copied" : "Copy"} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-current opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10">
            {copiedMessageId === message.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiedMessageId === message.id ? "Copied" : "Copy"}
          </button>
          {message.role === "assistant" && <VoiceSpeakerButton text={message.content} />}
        </div>
      </article>)}
      {sending && <div className="mr-auto flex items-center gap-2 rounded-2xl bg-[#eef6f1] px-5 py-4 text-sm text-slate-500 dark:bg-white/5"><span className="size-2 animate-pulse rounded-full bg-teal-600" /><span>Thinking…</span></div>}
      <div ref={bottomRef} />
    </section>

    {chatFiles.length > 0 && <section aria-label="Files in this chat" className="flex shrink-0 flex-wrap items-center gap-2 px-1">
      {chatFiles.map((file) => <div key={file.id} className="flex max-w-full items-center gap-1 rounded-lg border border-[#cbdcd4] bg-white py-1 pl-3 pr-1 text-xs font-medium text-slate-700 dark:border-[#28413a] dark:bg-[#14231f] dark:text-slate-200">
        <a href={`/api/v1/knowledge-bases/${encodeURIComponent(baseId)}/documents/${encodeURIComponent(file.id)}/file`} target="_blank" rel="noreferrer" title={`Open ${file.original_filename}`} className="max-w-56 truncate py-1 hover:underline">📄 {file.original_filename} <span className="text-slate-400">· {file.status}</span></a>
        <button type="button" onClick={() => void removeChatFile(file)} disabled={removingFileId === file.id} aria-label={`Remove ${file.original_filename}`} title="Remove file" className="grid size-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"><Trash2 className="size-3.5" /></button>
      </div>)}
    </section>}

    {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900 dark:bg-teal-950/40 dark:text-teal-100">{notice}</p>}
    {error && <div role="alert" className="flex shrink-0 items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><p className="min-w-0 flex-1">{error}</p><button type="button" aria-label="Dismiss error" title="Dismiss error" onClick={() => setError("")} className="grid size-7 shrink-0 place-items-center rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60"><X className="size-4" /></button></div>}

    <form onSubmit={(event) => void ask(event)} className="surface flex shrink-0 flex-col gap-1.5 rounded-2xl p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:gap-2 sm:p-2">
      <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,.pdf,application/pdf,.docx,.txt,.md,.markdown" className="hidden" onChange={(event) => { if (event.target.files?.length) stageAttachments(Array.from(event.target.files)); if (fileInput.current) fileInput.current.value = ""; }} />
      {pendingAttachments.length > 0 && <div className="flex max-w-full gap-2 overflow-x-auto px-1 pt-1" aria-label="Pending attachments">
        {pendingAttachments.map((attachment) => <div key={attachment.id} className="flex h-12 max-w-48 shrink-0 items-center gap-2 rounded-xl bg-slate-100 p-1.5 dark:bg-white/10">
          {attachment.previewUrl
            ? <img src={attachment.previewUrl} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
            : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-slate-500 dark:bg-[#141312] dark:text-slate-300">{attachment.file.type.startsWith("image/") ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}</span>}
          <span className="max-w-28 truncate text-xs text-slate-700 dark:text-slate-200">{attachment.file.name}</span>
          <button type="button" aria-label={`Remove ${attachment.file.name}`} onClick={() => removePendingAttachment(attachment.id)} className="grid size-7 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"><X className="size-3.5" /></button>
        </div>)}
      </div>}
      <div className="flex min-w-0 items-end gap-1.5 sm:gap-2">
        <button type="button" aria-label="Attach images or files" title="Attach images or files" disabled={uploading || sending} onClick={() => fileInput.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#cbdcd4] text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-[#28413a] dark:text-slate-200 dark:hover:bg-white/5 sm:size-12"><Plus className="size-5" /></button>
        <textarea rows={1} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={sending} placeholder="Ask anything…" aria-label="Your message" style={{ resize: "none" }} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white sm:min-h-12 sm:px-3 sm:py-3" />
        <div className="shrink-0 [&_button]:size-10 sm:[&_button]:size-12"><VoiceInputButton disabled={sending || uploading || indexing} onTranscript={(transcript) => setQuestion((current) => current ? `${current} ${transcript}` : transcript)} /></div>
        <button type="submit" disabled={sending || uploading || indexing || (!question.trim() && pendingAttachments.length === 0)} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#163a32] text-lg text-white transition hover:bg-[#1d4b40] disabled:cursor-not-allowed disabled:opacity-40 sm:size-12">↑</button>
      </div>
    </form>
    {(uploading || indexing) && <p role="status" className="text-sm text-slate-500">{uploading ? "Uploading your file…" : "Indexing your file… You can start chatting when it is ready."}</p>}
  </div>;
}

export const SettingsPage = () => {
  const { user, isGuest } = useAuth();
  const initials = (user?.name || "U").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const providerLabel = isGuest ? "Guest workspace" : user?.provider === "google" ? "Google account" : "Email account";

  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Your account</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Profile settings</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">View the profile details connected to your workspace.</p>
    </header>

    <section className="surface overflow-hidden rounded-3xl">
      <div className="h-28 bg-gradient-to-r from-[#163a32] via-[#246052] to-[#b5cdbb] dark:from-[#122720] dark:via-[#1b493c] dark:to-[#315b49]" />
      <div className="px-5 pb-6 sm:px-8 sm:pb-8">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:gap-5">
          {user?.profile_picture
            ? <img src={user.profile_picture} alt={`${user.name}'s profile`} referrerPolicy="no-referrer" className="size-24 rounded-3xl border-4 border-white bg-white object-cover shadow-lg dark:border-[#1d2420] dark:bg-[#1d2420] sm:size-28" />
            : <div aria-label="Profile initials" className="grid size-24 place-items-center rounded-3xl border-4 border-white bg-teal-200 text-3xl font-bold text-[#163a32] shadow-lg dark:border-[#1d2420] dark:bg-[#315b49] dark:text-white sm:size-28 sm:text-4xl">{initials}</div>}
          <div className="min-w-0 pb-1">
            <h2 className="truncate text-2xl font-bold text-slate-950 dark:text-white">{user?.name || "User"}</h2>
            <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">{user?.email}</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:bg-teal-950/50 dark:text-teal-200 sm:ml-auto sm:mb-2">{providerLabel}</span>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Profile information</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</dt><dd className="mt-2 break-words font-medium text-slate-900 dark:text-slate-100">{user?.name || "Not provided"}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email address</dt><dd className="mt-2 break-all font-medium text-slate-900 dark:text-slate-100">{user?.email || "Not provided"}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sign-in method</dt><dd className="mt-2 font-medium text-slate-900 dark:text-slate-100">{providerLabel}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Member since</dt><dd className="mt-2 font-medium text-slate-900 dark:text-slate-100">{user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}</dd></div>
          </dl>
        </div>
        {isGuest && <p className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">You’re using a guest workspace. Your profile is temporary; sign in or create an account from the bottom of the sidebar to keep an account profile.</p>}
      </div>
    </section>
  </div>;
};
