import { ArrowLeft, AudioLines, FileText, Languages, LockKeyhole, MessageSquareText, Moon, Share2, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  { title: "Ask questions about documents", text: "Upload supported files and ask questions with answers grounded in your material and source references.", Icon: FileText },
  { title: "Keep conversations organized", text: "Create separate chats, revisit saved history, and share eligible conversations with a read-only link.", Icon: MessageSquareText },
  { title: "Use voice and multiple languages", text: "Speak prompts using voice input, and choose from seven interface languages in Settings.", Icon: AudioLines },
  { title: "Choose your workspace preferences", text: "Use guest access or an account, and select light or dark appearance in Settings.", Icon: Moon },
  { title: "Private account workspaces", text: "Chats and documents are scoped to the signed-in account or guest workspace.", Icon: LockKeyhole },
  { title: "Payments and health information", text: "The app supports reply packs and subscriptions. Medical AI is for general health information only; it does not diagnose or prescribe.", Icon: WalletCards },
];

export function AboutPage() {
  return <div className="mx-auto w-full max-w-5xl space-y-8 pb-10">
    <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300"><ArrowLeft className="size-4" />Back to Overview</Link>
    <header className="rounded-3xl bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-700 p-6 text-white sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">About the project</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Cognitive RAG</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-50 sm:text-base">A document-aware AI knowledge assistant designed to help people ask questions, explore their files, and keep useful conversations in one private workspace.</p>
      <p className="mt-5 text-xs text-blue-200">First recorded project commit: August 21, 2026</p>
    </header>
    <section>
      <h2 className="text-xl font-bold text-slate-950 dark:text-white sm:text-2xl">What the app can do</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {features.map(({ title, text, Icon }) => <article key={title} className="surface rounded-2xl p-5"><span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200"><Icon className="size-5" /></span><h3 className="mt-4 font-semibold text-slate-950 dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p></article>)}
      </div>
    </section>
    <section className="surface rounded-2xl p-5 sm:p-6"><h2 className="text-lg font-bold text-slate-950 dark:text-white">About Medical AI</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Medical AI offers general educational health information in a separate chat history. It is not a medical device or a substitute for a licensed clinician. It cannot provide a true prescription or confirm a diagnosis.</p><Link to="/medical" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Open Medical AI<Share2 className="size-4" /></Link></section>
  </div>;
}
