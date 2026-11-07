import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Files, House, Link2, LogIn, Menu, MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Settings, Share2, Trash2, UserRound, X } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Logo } from "../components/Logo";
import { ProfileMenu } from "../components/ProfileMenu";
import { useAuth } from "../context/AuthContext";
import { createChatShare, deleteChat, listChats, savedChatOpenIntentKey, subscribeToChatHistoryChanges, type ChatSession } from "../services/api";

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
  const activeMenuRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  async function removeChat(chat: ChatSession) {
    setMenuChatId("");
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
    if (!menuChatId) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!activeMenuRef.current?.contains(target) && !menuPanelRef.current?.contains(target)) setMenuChatId("");
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuChatId("");
    };
    // Capture the pointer event so even clicks handled by nested sidebar
    // controls dismiss the menu reliably.
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuChatId]);

  useEffect(() => {
    if (!menuChatId) {
      setMenuPosition(null);
      return;
    }
    const updateMenuPosition = () => {
      const row = activeMenuRef.current;
      if (!row) return;
      const bounds = row.getBoundingClientRect();
      const menuHeight = 76;
      const openAbove = window.innerHeight - bounds.bottom < menuHeight + 8;
      setMenuPosition({
        top: openAbove ? Math.max(8, bounds.top - menuHeight - 4) : bounds.bottom + 4,
        left: Math.max(8, Math.min(window.innerWidth - 136, bounds.right - 132)),
      });
    };
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuChatId]);

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
          {chats.map((chat, index) => (
            <div key={chat.id} ref={menuChatId === chat.id ? activeMenuRef : undefined} className="group relative flex min-w-0 items-center">
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
              {menuChatId === chat.id && menuPosition && createPortal(<div ref={menuPanelRef} style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left }} className="z-[100] w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <button type="button" disabled={deletingChatId === chat.id} onClick={() => void removeChat(chat)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/30"><Trash2 className="size-3.5" />Delete chat</button>
                <button type="button" onClick={() => setMenuChatId("")} className="mt-0.5 flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Cancel</button>
              </div>, document.body)}
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
  const [searchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");
  const [sharing, setSharing] = useState(false);
  const activeChatId = location.pathname === "/chat" ? searchParams.get("chat") : null;
  const [sidebarVisible, setSidebarVisible] = useState(
    () => window.localStorage.getItem("knowledge-platform:sidebar-hidden") !== "true"
  );

  useEffect(() => {
    window.localStorage.setItem("knowledge-platform:sidebar-hidden", String(!sidebarVisible));
  }, [sidebarVisible]);

  async function prepareChatShare() {
    if (!activeChatId || sharing) return;
    setSharing(true);
    setShareError("");
    try {
      const { token } = await createChatShare(activeChatId);
      setShareUrl(`${window.location.origin}/shared?token=${encodeURIComponent(token)}`);
    } catch (cause) {
      setShareError(cause instanceof Error ? cause.message : "Could not create the share link.");
    } finally {
      setSharing(false);
    }
  }

  async function copyChatShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareError("Link copied. Anyone with it can read this conversation.");
    } catch {
      setShareError("Copy failed. Select the link and copy it manually.");
    }
  }

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
              {activeChatId && <button type="button" onClick={() => void prepareChatShare()} disabled={sharing} aria-label="Share this chat" title="Share this chat" className="grid size-10 place-items-center rounded-xl text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10"><Share2 className="size-5" /></button>}
              <div className="md:hidden"><ProfileMenu align="right" /></div>
            </div>
          </div>
        </header>
        <section className={`mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 ${location.pathname === "/chat" ? "mobile-chat-outlet" : ""}`}>
          <Outlet />
        </section>
      </section>
      {shareError && !shareUrl && <div role="alert" className="fixed bottom-5 right-5 z-[130] max-w-sm rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-800 shadow-xl dark:bg-rose-950 dark:text-rose-100">{shareError}</div>}
      {shareUrl && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShareUrl(""); setShareError(""); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="share-chat-title" className="surface w-full max-w-md rounded-2xl p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><h2 id="share-chat-title" className="text-lg font-semibold text-slate-900 dark:text-white">Share this chat</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Anyone with the link can read this conversation. Uploaded file contents remain private.</p></div><button type="button" onClick={() => { setShareUrl(""); setShareError(""); }} aria-label="Close share dialog" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="size-4" /></button></div>
          <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-black/20"><Link2 className="size-4 shrink-0 text-slate-500" /><input readOnly value={shareUrl} aria-label="Chat share link" className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200" /><button type="button" onClick={() => void copyChatShareLink()} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800">Copy</button></div>
          {shareError && <p role="status" className="mt-2 text-xs text-teal-700 dark:text-teal-300">{shareError}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><a href={`https://wa.me/?text=${encodeURIComponent(`${document.title}: ${shareUrl}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1fb95a]">WhatsApp <ExternalLink className="size-3.5" /></a>{typeof navigator.share === "function" && <button type="button" onClick={() => void navigator.share({ title: "Shared chat", url: shareUrl })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-white/5"><Share2 className="size-4" />More options</button>}</div>
        </section>
      </div>}
    </main>
  );
}
