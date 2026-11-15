import { useEffect, useState, type FormEvent } from "react";
import { HeartPulse, MessageSquarePlus, Send, ShieldAlert, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { MarkdownMessage } from "../components/MarkdownMessage";
import { createChat, deleteChat, listChats, listMessages, notifyChatHistoryChanged, sendMessage, type ChatMessage, type ChatSession } from "../services/api";

export function MedicalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get("chat") || "";
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void listChats().then((items) => {
      if (active) setChats(items.filter((chat) => chat.category === "medical"));
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load medical conversations.");
    });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    if (!selectedId) { setMessages([]); return () => { active = false; }; }
    setLoading(true);
    setError("");
    void listChats().then(async (items) => {
      const session = items.find((chat) => chat.id === selectedId && chat.category === "medical");
      if (!session) throw new Error("That medical conversation could not be found.");
      return listMessages(session.id);
    }).then((items) => { if (active) setMessages(items); }).catch((cause) => {
      if (active) { setMessages([]); setError(cause instanceof Error ? cause.message : "Could not load this conversation."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  async function startNewChat() {
    setError("");
    try {
      const session = await createChat(null, "Medical conversation", "medical");
      notifyChatHistoryChanged();
      navigate(`/medical?chat=${encodeURIComponent(session.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start a medical conversation.");
    }
  }

  async function removeChat(chat: ChatSession) {
    try {
      await deleteChat(chat.id);
      setChats((current) => current.filter((item) => item.id !== chat.id));
      notifyChatHistoryChanged();
      if (selectedId === chat.id) navigate("/medical", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this conversation.");
    }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = question.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    try {
      let sessionId = selectedId;
      if (!sessionId) {
        const session = await createChat(null, content.slice(0, 60) || "Medical conversation", "medical");
        sessionId = session.id;
        navigate(`/medical?chat=${encodeURIComponent(sessionId)}`, { replace: true });
      }
      const reply = await sendMessage(sessionId, content);
      setMessages((current) => [...current, reply.user_message, reply.assistant_message]);
      setQuestion("");
      notifyChatHistoryChanged();
      void listChats().then((items) => setChats(items.filter((chat) => chat.category === "medical")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not get a response. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8 lg:flex-row">
    <aside className="surface h-fit w-full shrink-0 rounded-2xl p-4 lg:sticky lg:top-3 lg:w-64">
      <button type="button" onClick={() => void startNewChat()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"><MessageSquarePlus className="size-4" />New medical chat</button>
      <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Medical chat history</h2>
      <div className="max-h-72 space-y-1 overflow-y-auto lg:max-h-[55vh]">
        {chats.length === 0 ? <p className="px-2 py-3 text-sm text-slate-500 dark:text-slate-400">Your medical conversations will appear here.</p> : chats.map((chat) => <div key={chat.id} className={`group flex items-center gap-1 rounded-lg ${selectedId === chat.id ? "bg-blue-50 dark:bg-white/10" : "hover:bg-slate-100 dark:hover:bg-white/5"}`}><button type="button" onClick={() => navigate(`/medical?chat=${encodeURIComponent(chat.id)}`)} className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm text-slate-800 dark:text-slate-200">{chat.title || "Medical conversation"}</button><button type="button" aria-label={`Delete ${chat.title || "medical conversation"}`} title="Delete conversation" onClick={() => void removeChat(chat)} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"><Trash2 className="size-4" /></button></div>)}
      </div>
    </aside>

    <section className="surface flex min-h-[70vh] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <header className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><HeartPulse className="size-6" /></span><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-300">Cognitive RAG</p><h1 className="text-xl font-bold text-slate-950 dark:text-white sm:text-2xl">Medical AI · Health information</h1></div></div>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Ask general health questions. This assistant cannot diagnose diseases, predict an illness, or provide prescriptions or medication doses. Please consult a licensed healthcare professional for personal medical advice.</p>
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><ShieldAlert className="mt-0.5 size-4 shrink-0" />For severe, sudden, or rapidly worsening symptoms, contact local emergency services or seek urgent medical care.</p>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {loading ? <p className="text-sm text-slate-500">Loading conversation…</p> : messages.length === 0 ? <div className="mx-auto mt-10 max-w-lg text-center"><HeartPulse className="mx-auto size-8 text-blue-600 dark:text-blue-300" /><h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">What health topic can I explain?</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">I can explain general health terms, common prevention guidance, and what questions to ask a clinician.</p></div> : messages.map((message) => <article key={message.id} className={message.role === "user" ? "ml-auto w-fit max-w-[90%] rounded-2xl bg-blue-600 px-4 py-3 text-white" : "mr-auto w-full max-w-3xl text-slate-900 dark:text-slate-100"}>{message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>}</article>)}
      </div>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800 sm:p-4">
        {error && <p role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
        <form onSubmit={(event) => void ask(event)} className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-900">
          <textarea rows={1} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask a general health question…" aria-label="Ask a general health question" className="max-h-36 min-h-11 min-w-0 flex-1 resize-y bg-transparent px-2 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
          <button type="submit" disabled={sending || !question.trim()} aria-label="Send question" title="Send question" className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">{sending ? <span className="text-xs">…</span> : <Send className="size-4" />}</button>
        </form>
      </div>
    </section>
  </div>;
}
