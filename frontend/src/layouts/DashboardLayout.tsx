import { useEffect, useState } from "react";
import { LogIn, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Logo } from "../components/Logo";
import { ProfileMenu } from "../components/ProfileMenu";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { listChats, subscribeToChatHistoryChanges, type ChatSession } from "../services/api";

const links = [
  ["/dashboard", "Overview", "⌂"],
  ["/chat", "Chat", "✦"],
  ["/documents", "Documents", "▤"],
  ["/settings", "Settings", "⚙"],
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1" aria-label="Primary navigation">
      {links.map(([to, label, icon]) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? "bg-teal-100 text-teal-950 dark:bg-white/10 dark:text-teal-200"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            }`
          }
        >
          <span className="grid size-5 place-items-center text-base" aria-hidden="true">{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function NewChatButton() {
  return (
    <a
      href="/chat?new=1"
      className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-bold text-[#102522] transition hover:bg-teal-200"
    >
      <span aria-hidden="true">+</span> New chat
    </a>
  );
}

function RecentChats({ onNavigate }: { onNavigate?: () => void }) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedChatId = new URLSearchParams(location.search).get("chat");

  useEffect(() => {
    let active = true;
    const loadChats = () => {
      void listChats().then((items) => {
        if (active) setChats(items);
      }).catch(() => {
        if (active) setChats([]);
      });
    };
    loadChats();
    const unsubscribe = subscribeToChatHistoryChanges(loadChats);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [location.key]);

  return (
    <section className="mt-6 flex min-h-0 flex-1 flex-col" aria-label="Saved chats">
      <h2 className="mb-2 shrink-0 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chat history</h2>
      {chats.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">Your saved chats will appear here.</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              title={chat.title}
              onClick={() => {
                navigate(`/chat?chat=${encodeURIComponent(chat.id)}`);
                onNavigate?.();
              }}
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                selectedChatId === chat.id
                  ? "bg-teal-100 font-medium text-teal-950 dark:bg-white/10 dark:text-teal-100"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
              }`}
            >
              {chat.title || "New chat"}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function DashboardLayout() {
  const { isGuest } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(
    () => window.localStorage.getItem("knowledge-platform:sidebar-hidden") !== "true"
  );

  useEffect(() => {
    window.localStorage.setItem("knowledge-platform:sidebar-hidden", String(!sidebarVisible));
  }, [sidebarVisible]);

  return (
    <main className="app-shell flex h-[100dvh] min-h-[100svh] overflow-hidden">
      {sidebarVisible && <aside className="app-sidebar hidden h-full w-64 shrink-0 flex-col justify-between overflow-hidden border-r border-slate-200 bg-white p-5 text-slate-800 dark:border-[#32302c] dark:bg-[#141312] dark:text-slate-200 md:flex">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-10 px-2"><Logo /></div>
          <NewChatButton />
          <Navigation />
          <RecentChats />
        </div>
        <div className="shrink-0">
          {isGuest && <a href="/account" className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-700 px-3 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-white/5"><LogIn className="size-4" />Sign in or sign up</a>}
          <ProfileMenu />
        </div>
      </aside>}

      {menuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}
      <aside
        id="mobile-navigation"
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
        className={`app-sidebar fixed inset-y-0 left-0 z-30 flex h-[100dvh] min-h-[100svh] w-72 flex-col justify-between overflow-hidden border-r border-slate-200 bg-white p-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-slate-800 transition-transform dark:border-[#32302c] dark:bg-[#141312] dark:text-slate-200 md:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-10 flex items-center justify-between px-2">
            <Logo />
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation"
              className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
            ><X className="size-5" /></button>
          </div>
          <NewChatButton />
          <Navigation onNavigate={() => setMenuOpen(false)} />
          <RecentChats onNavigate={() => setMenuOpen(false)} />
        </div>
        <div className="shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">{isGuest && <a href="/account" onClick={() => setMenuOpen(false)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-700 px-3 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-white/5"><LogIn className="size-4" />Sign in or sign up</a>}<ProfileMenu /></div>
      </aside>

      <section className="app-main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[#dce7e0] bg-white/90 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur dark:border-[#28413a] dark:bg-[#101a18]/90">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              title="Open menu, chat history, and account"
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-[#3a3935] dark:bg-[#1c1b18] dark:text-slate-100 dark:hover:bg-white/10 md:hidden"
            ><Menu className="size-5" /></button>
            <div className="md:hidden"><Logo compact /></div>
            <button
              type="button"
              onClick={() => setSidebarVisible((visible) => !visible)}
              aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              aria-pressed={sidebarVisible}
              className="hidden rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 md:inline-flex"
            >{sidebarVisible ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}</button>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <div className="md:hidden"><ProfileMenu align="right" /></div>
            </div>
          </div>
        </header>
        <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
          <Outlet />
        </section>
      </section>
    </main>
  );
}
