import { useEffect, useRef, useState } from "react";
import { Files, House, LogIn, Menu, MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Settings, Trash2, UserRound, X } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Logo } from "../components/Logo";
import { ProfileMenu } from "../components/ProfileMenu";
import { useAuth } from "../context/AuthContext";
import { deleteChat, listChats, savedChatOpenIntentKey, subscribeToChatHistoryChanges, type ChatSession } from "../services/api";

const links = [
  { to: "/dashboard", label: "Overview", Icon: House },
  { to: "/chat", label: "Chat", Icon: MessageSquare },
  { to: "/documents", label: "Documents", Icon: Files },
  { to: "/settings", label: "Settings", Icon: Settings },
  { to: "/profile", label: "Profile settings", Icon: UserRound },
];

function Navigation({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <nav className="space-y-1" aria-label="Primary navigation">
      {links.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          title={compact ? label : undefined}
          aria-label={compact ? label : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${compact ? "justify-center px-0" : ""} ${
              isActive
                ? "bg-teal-100 text-teal-950 dark:bg-white/10 dark:text-teal-200"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            }`
          }
        >
          <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true"><Icon className="size-5" /></span>
          {!compact && label}
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
  const [menuChatId, setMenuChatId] = useState("");
  const [deletingChatId, setDeletingChatId] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const selectedChatId = new URLSearchParams(location.search).get("chat");
  const longPressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  async function removeChat(chat: ChatSession) {
    setMenuChatId("");
    if (!window.confirm(`Delete “${chat.title || "New chat"}” from chat history? Files in Documents will stay saved.`)) return;
    setDeletingChatId(chat.id);
    try {
      await deleteChat(chat.id);
      setChats((current) => current.filter((item) => item.id !== chat.id));
      if (selectedChatId === chat.id) navigate("/chat", { replace: true });
      onNavigate?.();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Could not delete this chat.");
    } finally {
      setDeletingChatId("");
    }
  }

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
            <div key={chat.id} className="group relative flex min-w-0 items-center">
              <button
                type="button"
                title={chat.title}
                onTouchStart={() => {
                  suppressClick.current = false;
                  clearLongPressTimer();
                  longPressTimer.current = window.setTimeout(() => {
                    suppressClick.current = true;
                    setMenuChatId(chat.id);
                  }, 550);
                }}
                onTouchEnd={clearLongPressTimer}
                onTouchMove={clearLongPressTimer}
                onTouchCancel={clearLongPressTimer}
                onContextMenu={(event) => { event.preventDefault(); setMenuChatId(chat.id); }}
                onDoubleClick={() => setMenuChatId(chat.id)}
                onClick={() => {
                  if (suppressClick.current) { suppressClick.current = false; return; }
                  setMenuChatId("");
                  try { window.sessionStorage.setItem(savedChatOpenIntentKey, chat.id); } catch { /* Continue with in-app navigation. */ }
                  navigate(`/chat?chat=${encodeURIComponent(chat.id)}`);
                  onNavigate?.();
                }}
                className={`w-full min-w-0 truncate rounded-lg py-2 pl-3 pr-10 text-left text-sm transition ${
                  selectedChatId === chat.id
                    ? "bg-teal-100 font-medium text-teal-950 dark:bg-white/10 dark:text-teal-100"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                {chat.title || "New chat"}
              </button>
              <button
                type="button"
                aria-label={`More options for ${chat.title || "New chat"}`}
                title="Chat options"
                aria-expanded={menuChatId === chat.id}
                onClick={() => setMenuChatId((current) => current === chat.id ? "" : chat.id)}
                className="absolute right-1 grid size-8 place-items-center rounded-lg text-slate-500 opacity-100 hover:bg-slate-200 hover:text-slate-900 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              ><MoreHorizontal className="size-4" /></button>
              {menuChatId === chat.id && <div className="absolute right-1 top-1/2 z-30 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <button type="button" disabled={deletingChatId === chat.id} onClick={() => void removeChat(chat)} className="flex w-40 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/30"><Trash2 className="size-4" />Delete chat</button>
              </div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function DashboardLayout() {
  const { isGuest } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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

      {!sidebarVisible && <aside aria-label="Collapsed navigation" className="app-sidebar relative z-10 hidden h-full w-[4.5rem] shrink-0 flex-col justify-between overflow-visible border-r border-slate-200 bg-white px-2 py-3 text-slate-800 dark:border-[#32302c] dark:bg-[#141312] dark:text-slate-200 md:flex">
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={() => setSidebarVisible(true)} aria-label="Show sidebar" title="Show sidebar" className="grid size-11 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"><PanelLeftOpen className="size-5" /></button>
          <button type="button" onClick={() => navigate("/chat?new=1")} aria-label="New chat" title="New chat" className="grid size-11 place-items-center rounded-xl bg-teal-300 text-[#102522] transition hover:bg-teal-200"><Plus className="size-5" /></button>
          <div className="mt-1 w-full"><Navigation compact /></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          {isGuest && <a href="/account" aria-label="Sign in or sign up" title="Sign in or sign up" className="grid size-11 place-items-center rounded-xl border border-teal-700 text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-white/5"><LogIn className="size-4" /></a>}
          <ProfileMenu compact />
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
        className={`app-sidebar app-mobile-sidebar fixed inset-y-0 left-0 z-30 flex h-[100dvh] min-h-[100svh] w-72 flex-col justify-between overflow-hidden border-r border-slate-200 bg-white p-5 pt-[calc(env(safe-area-inset-top)_+_1rem)] text-slate-800 transition-transform dark:border-[#32302c] dark:bg-[#141312] dark:text-slate-200 md:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex shrink-0 items-center justify-between px-2">
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
        <header className="app-mobile-header shrink-0 border-b border-[#dce7e0] bg-white/90 pt-[calc(env(safe-area-inset-top)_+_1rem)] backdrop-blur dark:border-[#28413a] dark:bg-[#101a18]/90">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              title="Open menu, chat history, and account"
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-[#3a3935] dark:bg-[#1c1b18] dark:text-slate-100 dark:hover:bg-white/10 md:hidden"
            ><Menu className="size-5" /></button>
            <div className="md:hidden"><Logo compact /></div>
            {sidebarVisible && <button
              type="button"
              onClick={() => setSidebarVisible((visible) => !visible)}
              aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              aria-pressed={sidebarVisible}
              className="hidden rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 md:inline-flex"
            ><PanelLeftClose className="size-5" /></button>}
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="md:hidden"><ProfileMenu align="right" /></div>
            </div>
          </div>
        </header>
        <section className={`mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 ${location.pathname === "/chat" ? "mobile-chat-outlet" : ""}`}>
          <Outlet />
        </section>
      </section>
    </main>
  );
}
