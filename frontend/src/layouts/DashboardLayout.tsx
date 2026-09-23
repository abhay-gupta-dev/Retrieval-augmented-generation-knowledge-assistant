import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { Logo } from "../components/Logo";
import { ProfileMenu } from "../components/ProfileMenu";
import { ThemeToggle } from "../components/ThemeToggle";

const links = [["/dashboard", "Overview", "⌂"], ["/chat", "Chat", "✦"], ["/documents", "Documents", "▤"], ["/settings", "Settings", "⚙"]];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return <nav className="space-y-1" aria-label="Primary navigation">{links.map(([to, label, icon]) => <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => `app-sidebar-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "active" : ""}`}><span className="grid size-5 place-items-center text-base" aria-hidden="true">{icon}</span>{label}</NavLink>)}</nav>;
}

export function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <main className="app-shell flex h-screen min-h-0 overflow-hidden">
    <aside className="app-sidebar hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto p-5 md:flex"><div><div className="mb-10 px-2"><Logo /></div><button onClick={() => window.location.assign("/chat")} className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-bold text-[#102522] transition hover:bg-teal-200"><span aria-hidden="true">+</span> New chat</button><Navigation /></div><div className="space-y-4"><div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-[#a8c0b6]"><span className="mb-1 block font-semibold text-white">Private workspace</span>Your documents and conversations stay organized in one place.</div><ProfileMenu /></div></aside>
    {menuOpen && <button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20 bg-black/30 md:hidden" />}
    <aside className={`app-sidebar fixed inset-y-0 left-0 z-30 flex h-screen w-72 flex-col justify-between overflow-y-auto p-5 transition-transform md:hidden ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}><div><div className="mb-10 flex items-center justify-between px-2"><Logo /><button onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="rounded-lg p-2 text-[#a8c0b6]">×</button></div><button onClick={() => { setMenuOpen(false); window.location.assign("/chat"); }} className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-bold text-[#102522]"><span aria-hidden="true">+</span> New chat</button><Navigation onNavigate={() => setMenuOpen(false)} /></div><ProfileMenu /></aside>
    <section className="app-main flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden"><header className="border-b border-[#dce7e0] bg-white/80 backdrop-blur dark:border-[#28413a] dark:bg-[#101a18]/85"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><button onClick={() => setMenuOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden dark:text-slate-200 dark:hover:bg-slate-800">☰</button><div className="md:hidden"><Logo /></div><div className="ml-auto flex items-center gap-3"><ThemeToggle /><div className="md:hidden"><ProfileMenu /></div></div></div></header><section className="mx-auto h-full min-h-0 w-full max-w-7xl overflow-y-auto px-4 py-7 sm:px-6 sm:py-10"><Outlet /></section></section>
  </main>;
}
