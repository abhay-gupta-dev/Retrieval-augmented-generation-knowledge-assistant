import { Navigate, useSearchParams } from "react-router-dom";

import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const [params] = useSearchParams();
  if (!isLoading && user) return <Navigate to="/dashboard" replace />;
  const error = params.get("error");
  return <main className="min-h-screen bg-slate-50 px-5 py-6 dark:bg-slate-950"><div className="mx-auto flex max-w-6xl justify-between"><Logo /><ThemeToggle /></div><div className="mx-auto grid min-h-[calc(100vh-110px)] max-w-6xl place-items-center lg:grid-cols-2 lg:gap-20"><section className="hidden space-y-6 lg:block"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Private knowledge, amplified</p><h1 className="max-w-lg text-5xl font-bold tracking-tight text-slate-950 dark:text-white">Think clearly with knowledge that stays yours.</h1><p className="max-w-lg text-lg leading-8 text-slate-600 dark:text-slate-300">A secure workspace for your documents, conversations, and future AI agents.</p></section><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"><p className="text-sm font-medium text-indigo-600">Welcome</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Sign in to your workspace</h2><p className="mt-3 text-slate-600 dark:text-slate-300">Continue with your Google account to access your personal knowledge platform.</p>{error && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}<button onClick={login} disabled={isLoading} className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"><span className="font-bold text-[#4285F4]">G</span>Continue with Google</button><p className="mt-6 text-center text-xs leading-5 text-slate-500">By continuing, you agree to use this workspace responsibly. We only request basic identity information.</p></section></div></main>;
}
