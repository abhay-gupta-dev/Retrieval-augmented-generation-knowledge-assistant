import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BrainCircuit, FileText, Network, Sparkles } from "lucide-react";

import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export function LoginPage({ allowAuthenticated = false }: { allowAuthenticated?: boolean }) {
  const { user, isLoading, isGuest, loginWithGoogle, signIn, signUp, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const serverError = searchParams.get("error");

  if (!isLoading && user && !isGuest) return <Navigate to="/chat" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (registering) await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      navigate("/chat", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete your request.");
    } finally {
      setBusy(false);
    }
  }

  async function enterAsGuest() {
    setError("");
    setBusy(true);
    try {
      await continueAsGuest();
      navigate("/chat", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start a guest workspace. Check that the backend is running.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="h-[100dvh] min-h-[100svh] overflow-y-auto bg-[#f4f7f3] px-4 py-5 dark:bg-[#101a18] sm:px-6 sm:py-6">
    <div className="mx-auto flex max-w-6xl justify-between"><Logo /></div>
    <div className="mx-auto grid min-h-[calc(100svh-90px)] max-w-6xl items-center gap-5 py-5 sm:gap-8 sm:py-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-24">
      <section className="relative hidden aspect-[4/5] w-full max-w-[470px] place-self-center overflow-hidden rounded-3xl border border-[#d7e6dc] bg-[#e5f0e9] shadow-xl shadow-[#163a32]/10 dark:border-[#28413a] dark:bg-[#14251f] sm:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_47%,rgba(255,255,255,.96)_0%,rgba(250,253,249,.9)_42%,rgba(226,240,231,.75)_100%)] dark:bg-[radial-gradient(ellipse_at_50%_47%,rgba(34,63,53,.95)_0%,rgba(25,47,39,.94)_45%,rgba(16,32,27,.98)_100%)]" />
        <div className="absolute inset-5 rounded-[1.4rem] border border-[#b6cec0] dark:border-[#527160]" />
        <div className="absolute inset-8 rounded-[1.1rem] border border-[#cbdccf] dark:border-[#344f41]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#315c47] shadow-sm dark:bg-[#20392e] dark:text-[#c5e7d0]"><Sparkles className="size-4" /> Cognitive RAG</span>
          <div className="relative grid size-48 place-items-center sm:size-56" aria-hidden="true">
            <div className="absolute inset-0 rounded-full border border-[#9bbca6] dark:border-[#557665]" />
            <div className="absolute inset-5 rounded-full border border-dashed border-[#b2cbb8] dark:border-[#3e5d4c]" />
            <div className="absolute inset-10 rounded-full bg-[#cbded0]/70 blur-xl dark:bg-[#315743]/40" />
            <div className="relative grid size-20 place-items-center rounded-[1.6rem] border border-[#a9c4b0] bg-white text-[#315c47] shadow-lg dark:border-[#547862] dark:bg-[#20392e] dark:text-[#c5e7d0]"><BrainCircuit className="size-10" strokeWidth={1.4} /></div>
            <div className="absolute left-0 top-8 grid size-12 place-items-center rounded-2xl border border-[#c3d6c8] bg-white text-[#557762] shadow-md dark:border-[#496653] dark:bg-[#1d3429] dark:text-[#b6d9c0]"><FileText className="size-5" /></div>
            <div className="absolute right-0 top-8 grid size-12 place-items-center rounded-2xl border border-[#c3d6c8] bg-white text-[#557762] shadow-md dark:border-[#496653] dark:bg-[#1d3429] dark:text-[#b6d9c0]"><Network className="size-5" /></div>
            <div className="absolute bottom-1 grid size-11 place-items-center rounded-2xl border border-[#c3d6c8] bg-white text-[#557762] shadow-md dark:border-[#496653] dark:bg-[#1d3429] dark:text-[#b6d9c0]"><Sparkles className="size-5" /></div>
          </div>
          <h1 className="mt-8 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-[#18352a] dark:text-[#edf7ef]">Your knowledge, made clearer.</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#55705e] dark:text-[#b5cbb9]">Bring documents and ideas together. Ask a question and get thoughtful, grounded answers.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-md space-y-2 sm:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Private knowledge, amplified</p>
        <h1 className="max-w-xl text-2xl font-bold leading-tight tracking-tight text-slate-950 dark:text-white">A calmer way to think with your own knowledge.</h1>
        <p className="max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">Bring documents and ideas together for thoughtful, grounded answers.</p>
      </section>

      <section className="surface mx-auto w-full max-w-md rounded-2xl p-5 sm:p-8">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">{registering ? "Create your account" : "Welcome"}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{registering ? "Sign up with email" : "Use your workspace"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{isGuest ? "You’re using a guest workspace. Create an account or sign in whenever you choose." : "Use the app as a guest, or sign in to keep a personal account."}</p>

        {user && isGuest && <button type="button" onClick={() => window.location.assign("/chat")} className="mt-5 w-full rounded-xl border border-teal-700 px-4 py-3 font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-white/5">Continue as guest</button>}
        {!user && <button type="button" onClick={() => void enterAsGuest()} disabled={busy || isLoading} className="mt-5 w-full rounded-xl border border-teal-700 px-4 py-3 font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-white/5">Continue without an account</button>}

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />OR<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
        <button type="button" onClick={loginWithGoogle} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#163a32] px-4 py-3 font-semibold text-white shadow-lg shadow-[#163a32]/20 transition hover:bg-[#1d4b40]"><span className="rounded bg-white px-1.5 py-0.5 font-bold text-[#4285F4]">G</span>Continue with Google</button>
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">The site owner may receive your name and email in account-signup notifications. Guest-session alerts are anonymous.</p>

        <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-3">
          {registering && <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Name<input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>}
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Password<input type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
          {(error || serverError) && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error || serverError}</p>}
          <button type="submit" disabled={busy || isLoading} className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50">{busy ? "Please wait…" : registering ? "Create account" : "Sign in with email"}</button>
        </form>
        <button type="button" onClick={() => { setRegistering((value) => !value); setError(""); }} className="mt-4 w-full text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">{registering ? "Already have an account? Sign in" : "Need an account? Sign up"}</button>
        {allowAuthenticated && <Link to="/dashboard" className="mt-4 block text-center text-sm text-slate-500 hover:underline">Back to workspace</Link>}
      </section>
    </div>
    <footer className="mx-auto mt-4 w-full max-w-6xl border-t border-[#dce7e0] bg-[#f4f7f3] py-5 dark:border-[#28413a] dark:bg-[#101a18]">
      <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cognitive RAG</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Think clearly with the knowledge you trust.</p>
        </div>
        <nav aria-label="Social media" className="flex flex-wrap items-center justify-center gap-2">
          {[
            { name: "Instagram", href: "https://www.instagram.com/", path: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2A3 3 0 0 0 4 7v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.5-3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" },
            { name: "Telegram", href: "https://telegram.org/", path: "M21.8 4.2c.2-1.1-.9-1.6-1.8-1.2L2.6 9.8c-1.2.5-1.2 1.2-.2 1.5l4.5 1.4 1.7 5.3c.2.7.1 1 .8 1 .5 0 .8-.2 1.1-.5l2.2-2.1 4.6 3.4c.8.4 1.4.2 1.6-.8zM8 12.4l9-5.7c.4-.2.7-.1.4.2l-7.5 6.8-.3 3.2z" },
            { name: "Facebook", href: "https://www.facebook.com/", path: "M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5V10H7v3h2.8v8z" },
            { name: "LinkedIn", href: "https://www.linkedin.com/", path: "M5.2 3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM3.3 9h3.8v12H3.3zm6.1 0H13v1.6h.1A4.1 4.1 0 0 1 16.8 8c4 0 4.7 2.6 4.7 6V21h-3.8v-6.2c0-1.5 0-3.4-2.1-3.4s-2.4 1.6-2.4 3.3V21H9.4z" },
            { name: "GitHub", href: "https://github.com/", path: "M12 .8a11.2 11.2 0 0 0-3.5 21.8c.6.1.8-.3.8-.6v-2.1c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.2-1.7-1.2-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.3-5.1-5.5 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3.1 1.1a10.7 10.7 0 0 1 5.6 0c2.1-1.4 3.1-1.1 3.1-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.8 1.1 3 0 4.2-2.6 5.2-5.1 5.5.4.3.8 1 .8 2v3.1c0 .3.2.7.8.6A11.2 11.2 0 0 0 12 .8z" },
          ].map(({ name, href, path }) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={name} title={name} className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-teal-600 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-400 dark:hover:bg-teal-950/50 dark:hover:text-teal-200"><svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true"><path d={path} /></svg></a>)}
        </nav>
        <p className="text-xs text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} Cognitive RAG</p>
      </div>
    </footer>
  </main>;
}
