import { Activity, ArrowRight, AudioLines, BookOpen, CalendarDays, FileStack, Languages, LockKeyhole, MessageSquareText, Moon, Search, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

const highlights = [
  { title: "Ask your documents", text: "Bring PDFs, Word files, text, and Markdown into a workspace, then ask questions grounded in their contents.", Icon: FileStack },
  { title: "Get source-aware answers", text: "Retrieval augmented generation finds relevant passages and includes citations so you can check the context.", Icon: Search },
  { title: "Keep every conversation", text: "Return to saved chats, rename or remove them, and share selected conversations with a read-only link.", Icon: MessageSquareText },
  { title: "Work in your language", text: "Choose English, Hindi, Bengali, Tamil, Telugu, Marathi, or Gujarati in Settings.", Icon: Languages },
  { title: "Use voice and images", text: "Dictate prompts with voice input or ask questions about images in supported chats.", Icon: AudioLines },
  { title: "Make it yours", text: "Use guest access or sign in, switch appearance in Settings, and manage files in your private workspace.", Icon: Moon },
];

const steps = [
  { number: "01", title: "Add your material", text: "Upload documents or images to a workspace you control." },
  { number: "02", title: "Ask naturally", text: "Write or speak a question in the chat, with or without your documents." },
  { number: "03", title: "Review and continue", text: "Read the answer, check its sources when available, and return to the conversation later." },
];

export function AboutPage() {
  return <main className="mx-auto w-full max-w-6xl space-y-12 pb-12 sm:space-y-16">
    <header className="relative isolate overflow-hidden rounded-[2rem] bg-[#101b36] px-6 py-10 text-white shadow-xl shadow-blue-950/10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
      <div className="absolute -right-16 -top-24 -z-10 size-80 rounded-full bg-blue-500/30 blur-3xl" />
      <div className="absolute -bottom-40 left-1/3 -z-10 size-80 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100"><Sparkles className="size-3.5" />ABOUT COGNITIVE RAG</div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">Make your knowledge easier to use.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100/85 sm:text-lg sm:leading-8">Cognitive RAG brings your files and AI conversations together, helping you find useful context and get clear answers from the information you choose to provide.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/chat?new=1" className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-400">Start a conversation <ArrowRight className="size-4" /></Link>
          <Link to="/documents" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><BookOpen className="size-4" />Explore documents</Link>
        </div>
      </div>
      <div className="mt-10 grid max-w-3xl grid-cols-2 gap-3 border-t border-white/15 pt-6 sm:grid-cols-3">
        <div><p className="text-lg font-semibold">Document-aware</p><p className="mt-1 text-xs text-blue-100/70">Answers with context</p></div>
        <div><p className="text-lg font-semibold">Built for your workflow</p><p className="mt-1 text-xs text-blue-100/70">Chats, files, and voice</p></div>
        <div className="col-span-2 sm:col-span-1"><p className="text-lg font-semibold">Made for many users</p><p className="mt-1 text-xs text-blue-100/70">Guest and account access</p></div>
      </div>
    </header>

    <section>
      <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">A practical AI workspace</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Everything you need to ask better questions</h2><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">Bring information into one place, explore it conversationally, and pick up where you left off.</p></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {highlights.map(({ title, text, Icon }, index) => <article key={title} className="surface group rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-950/5 sm:p-6"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"><Icon className="size-5" /></span><span className="text-xs font-bold tracking-widest text-slate-300 dark:text-slate-600">0{index + 1}</span></div><h3 className="mt-5 text-base font-semibold text-slate-950 dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p></article>)}
      </div>
    </section>

    <section className="grid gap-8 rounded-3xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-white/[0.03] sm:p-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:p-10">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Simple by design</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">From a file to a useful answer</h2><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Start with your own material or open a chat and ask a general question. Your chats and documents stay organized in your workspace.</p></div>
      <ol className="space-y-3">{steps.map((step) => <li key={step.number} className="flex gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.04]"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{step.number}</span><div><h3 className="font-semibold text-slate-950 dark:text-white">{step.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.text}</p></div></li>)}</ol>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <article className="surface flex gap-4 rounded-2xl p-5 sm:p-6"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck className="size-5" /></span><div><h2 className="font-semibold text-slate-950 dark:text-white">Your workspace, your conversations</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Use the app as a guest or sign in to keep an account-based history. Sharing a chat creates a separate read-only link.</p></div></article>
      <article className="surface flex gap-4 rounded-2xl p-5 sm:p-6"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"><WalletCards className="size-5" /></span><div><h2 className="font-semibold text-slate-950 dark:text-white">Plans and project details</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Optional paid reply packs and subscriptions are available in Billing. The project’s first recorded repository commit was August 21, 2026.</p></div></article>
    </section>

    <footer className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Activity className="size-4 text-blue-600 dark:text-blue-300" /><span>Cognitive RAG · AI knowledge assistant</span><CalendarDays className="ml-2 size-4" /><span>Project started 2026</span></div><Link to="/dashboard" className="text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300">Back to overview →</Link></footer>
  </main>;
}
