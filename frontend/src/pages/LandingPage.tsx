import { useEffect } from "react";
import { ArrowRight, BookOpenText, FileSearch, Files, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Logo } from "../components/Logo";

const siteUrl = "https://retrieval-augmented-generation-know.vercel.app/";
const description = "Cognitive RAG is an AI knowledge assistant that helps you ask questions about PDFs and documents and get clear answers grounded in your sources.";

export function LandingPage() {
  useEffect(() => {
    document.title = "Cognitive RAG — Ask Questions About Your Documents";
    const descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    descriptionTag?.setAttribute("content", description);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    canonical?.setAttribute("href", siteUrl);
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    robots?.setAttribute("content", "index,follow");
  }, []);

  return <main className="landing-page min-h-screen overflow-x-hidden bg-[#f7faf8] text-slate-950 dark:bg-[#11100f] dark:text-white">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Logo />
      <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main navigation">
        <Link to="/login?mode=signup" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Get started</Link>
      </nav>
    </header>

    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.1fr_.9fr]">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200"><Sparkles className="size-3.5" /> Your documents, ready to answer</p>
        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">Understand your documents with <span className="text-blue-700 dark:text-blue-300">Cognitive RAG</span></h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">Upload PDFs and other documents, ask questions in plain language, and get clear answers grounded in the information you provided.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/chat" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-md shadow-blue-900/10 transition hover:bg-blue-700">Try Cognitive RAG <ArrowRight className="size-4" /></Link>
          <Link to="/login?mode=signup" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Create an account</Link>
        </div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Start in guest mode, or sign up to keep your account and chat history.</p>
      </div>
      <div className="relative mx-auto w-full max-w-lg">
        <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-blue-200/70 via-teal-100/60 to-transparent blur-2xl dark:from-blue-900/30 dark:via-teal-900/20" />
        <div className="surface relative rounded-3xl p-5 shadow-2xl shadow-slate-900/10 sm:p-7">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700"><div className="grid size-10 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200"><BookOpenText className="size-5" /></div><div><p className="font-semibold">Your document workspace</p><p className="text-xs text-slate-500 dark:text-slate-400">Private files · Source-grounded answers</p></div></div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-white/5"><FileSearch className="mt-0.5 size-5 shrink-0 text-blue-700 dark:text-blue-300" /><p className="text-sm leading-6 text-slate-700 dark:text-slate-200">Ask a question about your uploaded PDF in everyday language.</p></div>
          <div className="ml-7 mt-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 dark:border-blue-900 dark:bg-blue-950/30"><p className="text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">Cognitive RAG</p><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">Get a structured answer based on the relevant document passages, with sources you can review.</p></div>
          <div className="mt-5 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300"><Files className="size-3.5" /> PDF and document uploads</span><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300"><ShieldCheck className="size-3.5" /> Your own workspace</span></div>
        </div>
      </div>
    </section>

    <section className="border-y border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-white/[0.02]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-3">
        <article><h2 className="font-bold">Ask naturally</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Ask questions in your own words instead of searching through long files page by page.</p></article>
        <article><h2 className="font-bold">Use your files</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Bring PDFs, notes, and supported documents into a workspace you can ask about.</p></article>
        <article><h2 className="font-bold">Review the sources</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Answers can include references to retrieved documents so you can check the supporting material.</p></article>
      </div>
    </section>

    <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p>© {new Date().getFullYear()} Cognitive RAG · AI knowledge assistant for your documents.</p>
      <div className="flex gap-4"><Link to="/login" className="hover:text-blue-700 dark:hover:text-blue-300">Sign in</Link><Link to="/login?mode=signup" className="hover:text-blue-700 dark:hover:text-blue-300">Create account</Link></div>
    </footer>
  </main>;
}
