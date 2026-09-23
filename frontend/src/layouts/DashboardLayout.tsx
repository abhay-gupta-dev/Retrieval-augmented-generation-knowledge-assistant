import { NavLink, Outlet } from "react-router-dom";

import { Logo } from "../components/Logo";
import { ProfileMenu } from "../components/ProfileMenu";
import { ThemeToggle } from "../components/ThemeToggle";

const links = [["/dashboard", "Overview"], ["/chat", "Chat"], ["/documents", "Documents"], ["/settings", "Settings"]];

export function DashboardLayout() {
  return <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"><header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5"><Logo /><nav className="hidden gap-1 md:flex">{links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{label}</NavLink>)}</nav><div className="flex items-center gap-3"><ThemeToggle /><ProfileMenu /></div></div></header><section className="mx-auto max-w-7xl px-5 py-10"><Outlet /></section></main>;
}
