import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Copy, FileText, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { HealthStatus } from "../components/HealthStatus";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { VoiceInputButton, VoiceSpeakerButton } from "../components/VoiceControls";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};
import { attachKnowledgeBaseToChat, createChat, createKnowledgeBase, deleteDocument, getDashboardStats, getSharedChat, listChats, listDocuments, listKnowledgeBases, listMessages, notifyChatHistoryChanged, retryMessage, savedChatOpenIntentKey, sendImage, sendMessage, streamChatMessage, uploadDocument, type ChatMessage, type DashboardStats, type IndexedDocument, type KnowledgeBase, type SharedChat } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeToggle } from "../components/ThemeToggle";

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
  const [selected, setSelected] = useState("all");
  const [name, setName] = useState("");
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = selected === "all"
      ? Promise.all(bases.map((base) => listDocuments(base.id))).then((groups) => groups.flat().sort((a, b) => b.created_at.localeCompare(a.created_at)))
      : listDocuments(selected);
    void load
      .then((items) => { if (active) setDocuments(items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load documents."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bases, selected]);

  async function addBase(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const base = await createKnowledgeBase(name);
      setName("");
      await reload();
      setSelected(base.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create knowledge base.");
    }
  }

  async function addFile(file: File) {
    setError("");
    try {
      let targetBaseId = selected;
      if (selected === "all") {
        const defaultBase = bases.find((base) => base.name === "My documents");
        const targetBase = defaultBase ?? await createKnowledgeBase("My documents", "Files uploaded from the Documents page");
        targetBaseId = targetBase.id;
        if (!defaultBase) await reload();
      }
      await uploadDocument(targetBaseId, file);
      if (selected === "all") {
        const groups = await Promise.all([...bases, ...(bases.some((base) => base.id === targetBaseId) ? [] : [{ id: targetBaseId } as KnowledgeBase])].map((base) => listDocuments(base.id)));
        setDocuments(groups.flat().sort((a, b) => b.created_at.localeCompare(a.created_at)));
      } else {
        setDocuments(await listDocuments(targetBaseId));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    }
  }

  async function removeFile(file: IndexedDocument) {
    if (!window.confirm(`Permanently delete “${file.original_filename}” from your Documents? This also removes it from chats that use this saved image.`)) return;
    setDeletingId(file.id);
    setError("");
    try {
      await deleteDocument(file.knowledge_base_id, file.id);
      setDocuments((current) => current.filter((item) => item.id !== file.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this file.");
    } finally {
      setDeletingId("");
    }
  }

  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Knowledge</p><h1 className="text-3xl font-bold text-slate-950 dark:text-white">Documents</h1><p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">Your uploaded files and photos are saved here in your private workspace.</p></div>
      {bases.length > 0 && <select aria-label="Select collection" value={selected} onChange={(event) => setSelected(event.target.value)} className="rounded-xl border border-[#cbdcd4] bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm dark:border-[#28413a] dark:bg-[#14231f] dark:text-white"><option value="all">All documents</option>{bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}</select>}
    </div>
    <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <section className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Create a collection</p><h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">Organize your files</h2>
        <form onSubmit={(event) => void addBase(event)} className="mt-5 space-y-3"><input value={name} onChange={(event) => setName(event.target.value)} required placeholder="e.g. Personal files" className="w-full rounded-xl border border-[#cbdcd4] bg-white p-3 text-slate-900 outline-none focus:border-teal-500 dark:border-[#28413a] dark:bg-[#14231f] dark:text-white" /><button type="submit" className="w-full rounded-xl bg-[#163a32] px-4 py-3 font-semibold text-white transition hover:bg-[#1d4b40]">Create collection</button></form>
        <div className="mt-6 rounded-xl bg-[#eef6f1] p-4 text-sm leading-6 text-slate-600 dark:bg-white/5 dark:text-slate-300">Supported files: images, TXT, Markdown, PDF, and DOCX. Files uploaded in chat are saved here too.</div>
      </section>
      {selected ? <section className="surface rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700 dark:text-teal-300">{documents.length} file{documents.length === 1 ? "" : "s"}</p><h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{selected === "all" ? "All documents" : bases.find((base) => base.id === selected)?.name}</h2></div><button type="button" onClick={() => { setLoading(true); const load = selected === "all" ? Promise.all(bases.map((base) => listDocuments(base.id))).then((groups) => groups.flat().sort((a, b) => b.created_at.localeCompare(a.created_at))) : listDocuments(selected); void load.then(setDocuments).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not refresh files.")).finally(() => setLoading(false)); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-white/5">Refresh</button></div>
        <label className="mt-5 block cursor-pointer rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/50 p-7 text-center transition hover:bg-teal-50 dark:border-teal-800 dark:bg-teal-950/20 dark:hover:bg-teal-950/40"><input type="file" accept=".txt,.md,.pdf,.docx,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addFile(file); event.currentTarget.value = ""; }} /><span className="text-2xl" aria-hidden="true">↑</span><span className="mt-2 block font-semibold text-teal-900 dark:text-teal-200">Add a file or photo</span><span className="mt-1 block text-sm text-teal-700/70 dark:text-teal-300/70">Select a file to save it in this collection</span></label>
        {loading ? <div className="mt-6 space-y-3">{[1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}</div> : documents.length ? <div className="mt-6 space-y-3">{documents.map((document) => {
          const fileUrl = `/api/v1/knowledge-bases/${encodeURIComponent(document.knowledge_base_id)}/documents/${encodeURIComponent(document.id)}/file`;
          const isImage = document.content_type?.startsWith("image/");
          return <div key={document.id} className="flex items-center gap-3 rounded-xl border border-[#dce7e0] p-3 dark:border-[#28413a]">
            {isImage ? <a href={fileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${document.original_filename}`}><img src={fileUrl} alt={document.original_filename} className="size-14 rounded-lg object-cover" /></a> : <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800 dark:bg-white/5 dark:text-teal-200"><FileText className="size-5" /></span>}
            <div className="min-w-0 flex-1"><a href={fileUrl} target="_blank" rel="noreferrer" className="block truncate font-semibold text-slate-800 hover:underline dark:text-slate-100">{document.original_filename}</a><p className="mt-1 text-xs text-slate-500">{bases.find((base) => base.id === document.knowledge_base_id)?.name} · {document.size_bytes.toLocaleString()} bytes{document.status === "indexed" ? ` · ${document.chunk_count} chunks` : ""}{document.status === "stored" ? " · Saved" : ""}</p>{document.error_message && <p className="text-sm text-rose-600">{document.error_message}</p>}</div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${document.status === "indexed" || document.status === "stored" ? "bg-emerald-100 text-emerald-800" : document.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{document.status === "stored" ? "saved" : document.status}</span>
            <button type="button" onClick={() => void removeFile(document)} disabled={deletingId === document.id} aria-label={`Permanently delete ${document.original_filename}`} title="Permanently delete" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"><Trash2 className="size-4" /></button>
          </div>;
        })}</div> : <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">No files in this collection yet.</p>}
      </section> : <section className="surface flex min-h-64 items-center justify-center rounded-2xl p-8 text-center"><div><p className="text-3xl" aria-hidden="true">▤</p><h2 className="mt-3 text-xl font-bold text-slate-950 dark:text-white">Create a collection to get started</h2><p className="mt-2 text-sm text-slate-500">Chat uploads create a collection automatically.</p></div></section>}
    </div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
  </div>;
}

export function ChatPage() {
  const { user } = useAuth();
  const { reload } = useKnowledgeBases();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedChatId = searchParams.get("chat");
  const newChatRequested = searchParams.get("new") === "1";
  const [baseId, setBaseId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imagePreviewUrls = useRef<string[]>([]);
  const openedSavedChatRef = useRef("");

  useEffect(() => () => {
    imagePreviewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    let hasSavedChatIntent = false;
    if (requestedChatId) {
      try {
        hasSavedChatIntent = window.sessionStorage.getItem(savedChatOpenIntentKey) === requestedChatId;
        if (hasSavedChatIntent) window.sessionStorage.removeItem(savedChatOpenIntentKey);
      } catch {
        hasSavedChatIntent = false;
      }
      hasSavedChatIntent ||= openedSavedChatRef.current === requestedChatId;
    }

    if (newChatRequested || !requestedChatId || !hasSavedChatIntent) {
      openedSavedChatRef.current = "";
      startNewChat();
      if (requestedChatId || newChatRequested) navigate("/chat", { replace: true });
      return;
    }
    openedSavedChatRef.current = requestedChatId;
    void listChats()
      .then(async (chats) => {
        const targetChat = chats.find((chat) => chat.id === requestedChatId);
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
  }, [location.key, newChatRequested, requestedChatId, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function startNewChat() {
    setSessionId("");
    setBaseId("");
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

  function markChatAsCurrent(chatId: string) {
    if (requestedChatId === chatId) return;
    try {
      window.sessionStorage.setItem(savedChatOpenIntentKey, chatId);
    } catch {
      // The route still updates when session storage is unavailable.
    }
    navigate(`/chat?chat=${encodeURIComponent(chatId)}`, { replace: true });
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

  async function ask(event: FormEvent) {
    event.preventDefault();
    const attachments = [...pendingAttachments];
    const imageAttachments = attachments.filter((attachment) => attachment.file.type.startsWith("image/"));
    const documentAttachments = attachments.filter((attachment) => !attachment.file.type.startsWith("image/"));
    const prompt = question.trim();
    const documentPrompt = prompt || "Please summarize the attached document.";
    if ((!prompt && attachments.length === 0) || sending) return;

    setSending(true);
    setError("");
    setNotice("");
    try {
      let activeSessionId = sessionId;
      let activeKnowledgeBaseId = baseId;
      if (attachments.length > 0 && !activeKnowledgeBaseId) {
        const base = await createKnowledgeBase(`Chat files ${Date.now()}`, "Files uploaded from this conversation");
        activeKnowledgeBaseId = base.id;
        setBaseId(base.id);
        await reload();
      }
      if (!activeSessionId) {
        const chat = await createChat(activeKnowledgeBaseId || null);
        activeSessionId = chat.id;
        setSessionId(chat.id);
        notifyChatHistoryChanged();
      } else if (attachments.length > 0 && activeKnowledgeBaseId && activeKnowledgeBaseId !== baseId) {
        await attachKnowledgeBaseToChat(activeSessionId, activeKnowledgeBaseId);
      }

      if (documentAttachments.length > 0 && activeKnowledgeBaseId) {
        setUploading(true);
        for (const attachment of documentAttachments) {
          setNotice(`Uploading ${attachment.file.name}…`);
          const uploaded = await uploadDocument(activeKnowledgeBaseId, attachment.file);
          setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
          setIndexing(true);
          setNotice(`Preparing ${attachment.file.name}…`);
          let ready = false;
          for (let attempt = 0; attempt < 60; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 2000));
            try {
              const documents = await listDocuments(activeKnowledgeBaseId);
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
          if (!activeKnowledgeBaseId) throw new Error("Could not prepare a Documents collection for this image.");
          setUploading(true);
          setNotice(`Saving ${attachment.file.name} to Documents…`);
          const savedImage = await uploadDocument(activeKnowledgeBaseId, attachment.file);
          // The attachment has been sent and safely saved. Remove its composer
          // chip now instead of leaving it visible while vision inference runs.
          setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
          setNotice(`Analyzing ${attachment.file.name}…`);
          const reply = await sendImage(activeSessionId, prompt, savedImage.id);
          let previewUrl = attachment.previewUrl;
          if (!previewUrl) {
            previewUrl = URL.createObjectURL(attachment.file);
            imagePreviewUrls.current.push(previewUrl);
          }
          setImagePreviews((current) => ({ ...current, [reply.user_message.id]: previewUrl! }));
          setMessages((current) => [...current, reply.user_message, reply.assistant_message]);
          markChatAsCurrent(activeSessionId);
          notifyChatHistoryChanged();
        }
        setUploading(false);
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
        markChatAsCurrent(activeSessionId);
        notifyChatHistoryChanged();
        return;
      }

      let streamedText = "";
      let streamedCitations: ChatMessage["citations"] = [];
      let userMessageAccepted = false;
      try {
        await streamChatMessage(activeSessionId, documentPrompt, documentAttachments.map((attachment) => attachment.file.name), {
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
            markChatAsCurrent(activeSessionId);
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
        markChatAsCurrent(activeSessionId);
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
      {messages.map((message) => {
        const imageSrc = message.role === "user" ? (message.attachment_url || imagePreviews[message.id]) : undefined;
        const hasPhoto = Boolean(imageSrc);
        return <article key={message.id} className={`break-words ${message.role === "user" ? hasPhoto ? "ml-auto w-fit max-w-[min(90%,680px)]" : "ml-auto w-fit max-w-[85%] rounded-2xl bg-[#163a32] px-3 py-2.5 text-white sm:px-4 sm:py-3" : "mr-auto w-full max-w-full py-1 text-slate-900 dark:text-white"}`}>
        {imageSrc && <img src={imageSrc} alt={message.attachment_filename ? `Image attached: ${message.attachment_filename}` : "Image attached to this message"} className="block h-auto w-auto max-h-[65vh] max-w-[min(72vw,640px)] rounded-xl object-contain" />}
        {message.role === "user" && !message.attachment_url && message.attachment_filename && <div className="mb-3 flex max-w-full flex-wrap gap-2">{message.attachment_filename.split("\n").filter(Boolean).map((filename, index) => <div key={`${message.id}-${index}`} className="flex max-w-full items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-white"><FileText className="size-4 shrink-0" /><span className="max-w-64 truncate">{filename}</span></div>)}</div>}
        {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : message.content && <p className={`${hasPhoto ? "mt-2 w-fit rounded-xl bg-[#163a32] px-3 py-2.5 text-white" : ""} whitespace-pre-wrap text-[15px] leading-7`}>{message.attachment_url ? message.content : message.content.replace(/^\[Image attached: [^\]]+\]\s*/, "")}</p>}
        {message.citations.length > 0 && <div className="mt-4 border-t border-current/10 pt-3">{message.citations.map((citation) => <p key={`${citation.document_id}-${citation.chunk_index}`} className="text-xs opacity-70">Source: {citation.filename}</p>)}</div>}
        {(message.role === "assistant" || message.content.trim() || !hasPhoto) && <div className={`${hasPhoto ? "mt-2" : "mt-3"} flex items-center gap-2`}>
          <button type="button" onClick={() => void copyMessage(message)} aria-label={copiedMessageId === message.id ? "Message copied" : "Copy message"} title={copiedMessageId === message.id ? "Copied" : "Copy"} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-current opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10">
            {copiedMessageId === message.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiedMessageId === message.id ? "Copied" : "Copy"}
          </button>
          {message.role === "assistant" && <VoiceSpeakerButton text={message.content} />}
        </div>}
      </article>;
      })}
      {sending && <div className="mr-auto flex items-center gap-2 rounded-2xl bg-[#eef6f1] px-5 py-4 text-sm text-slate-500 dark:bg-white/5"><span className="size-2 animate-pulse rounded-full bg-teal-600" /><span>Thinking…</span></div>}
      <div ref={bottomRef} />
    </section>

    {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900 dark:bg-teal-950/40 dark:text-teal-100">{notice}</p>}
    {error && <div role="alert" className="flex shrink-0 items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><p className="min-w-0 flex-1">{error}</p><button type="button" aria-label="Dismiss error" title="Dismiss error" onClick={() => setError("")} className="grid size-7 shrink-0 place-items-center rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60"><X className="size-4" /></button></div>}

    <form onSubmit={(event) => void ask(event)} className="chat-composer surface flex shrink-0 flex-col gap-1.5 rounded-2xl p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:gap-2 sm:p-2">
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
        <textarea rows={1} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={sending} placeholder="Ask anything…" aria-label="Your message" style={{ resize: "none" }} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none dark:text-white sm:min-h-12 sm:px-3 sm:py-3" />
        <div className="shrink-0 [&_button]:size-10 sm:[&_button]:size-12"><VoiceInputButton disabled={sending || uploading || indexing} onTranscript={(transcript) => setQuestion((current) => current ? `${current} ${transcript}` : transcript)} /></div>
        <button type="submit" disabled={sending || uploading || indexing || (!question.trim() && pendingAttachments.length === 0)} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#163a32] text-lg text-white transition hover:bg-[#1d4b40] disabled:cursor-not-allowed disabled:opacity-40 sm:size-12">↑</button>
      </div>
    </form>
    {(uploading || indexing) && <p role="status" className="text-sm text-slate-500">{uploading ? "Uploading your file…" : "Indexing your file… You can start chatting when it is ready."}</p>}
  </div>;
}

export function SharedChatPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [sharedChat, setSharedChat] = useState<SharedChat | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!token) { setError("This share link is missing its token."); return () => { active = false; }; }
    void getSharedChat(token).then((chat) => { if (active) setSharedChat(chat); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "This shared conversation is unavailable."); });
    return () => { active = false; };
  }, [token]);

  return <main className="h-[100dvh] min-h-screen overflow-y-auto overscroll-contain touch-pan-y bg-slate-50 px-4 py-8 pb-16 text-slate-900 dark:bg-[#11100f] dark:text-white sm:px-8">
    <div className="mx-auto max-w-3xl"><a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 dark:text-teal-300">✦ Cognitive RAG</a>{error ? <section className="surface mt-8 rounded-2xl p-6"><h1 className="text-xl font-semibold">Shared chat unavailable</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</p></section> : !sharedChat ? <p className="mt-10 text-sm text-slate-500">Loading shared conversation…</p> : <><h1 className="mt-8 text-2xl font-bold sm:text-3xl">{sharedChat.title}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Read-only shared conversation</p><section className="mt-8 space-y-7">{sharedChat.messages.map((message, index) => <article key={`${message.created_at}-${index}`} className={message.role === "user" ? message.attachment_url ? "ml-auto w-fit max-w-[90%]" : "ml-auto w-fit max-w-[88%] rounded-2xl bg-[#163a32] px-4 py-3 text-white" : "mr-auto w-full py-1 text-slate-900 dark:text-white"}><p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">{message.role === "user" ? "User" : "Cognitive RAG"}</p>{message.attachment_url && <img src={message.attachment_url} alt={message.attachment_filename || "Image shared in this conversation"} className="block h-auto w-auto max-h-[65vh] max-w-[min(72vw,640px)] rounded-xl object-contain" />}{message.attachment_filename && !message.attachment_url && <p className="mb-2 text-xs opacity-70">Attachment: {message.attachment_filename}</p>}{message.content && (message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p className={`${message.attachment_url ? "mt-2 w-fit rounded-xl bg-[#163a32] px-3 py-2.5 text-white" : ""} whitespace-pre-wrap text-[15px] leading-7`}>{message.content}</p>)}{message.citations.length > 0 && <div className="mt-4 border-t border-current/10 pt-3">{message.citations.map((citation) => <p key={`${citation.document_id}-${citation.chunk_index}`} className="text-xs opacity-70">Source: {citation.filename}</p>)}</div>}</article>)}</section></>}</div>
  </main>;
}

export function SettingsPage() {
  const { theme } = useTheme();
  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Preferences</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Settings</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Adjust how Cognitive RAG looks on this device.</p>
    </header>
    <section className="surface flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Appearance</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Current mode: <span className="font-semibold capitalize">{theme}</span></p>
      </div>
      <ThemeToggle />
    </section>
  </div>;
}

export const ProfilePage = () => {
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
