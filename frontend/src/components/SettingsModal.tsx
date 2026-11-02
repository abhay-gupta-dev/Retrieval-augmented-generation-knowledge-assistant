import { useState } from "react";
import { LogOut, Moon, Settings, Sun, Trash2, User, X } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { clearAllChats } from "../services/api";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onChatsCleared?: () => void;
  onOpenAuth?: () => void;
};

export function SettingsModal({
  isOpen,
  onClose,
  onChatsCleared,
  onOpenAuth,
}: SettingsModalProps) {
  const { user, isGuest, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (!isOpen) return null;

  async function handleClearChats() {
    setClearing(true);
    try {
      await clearAllChats();
      setConfirmClear(false);
      onChatsCleared?.();
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#32302c] bg-[#1c1b18] p-6 shadow-2xl text-[#ececec]">
        <div className="flex items-center justify-between border-b border-[#32302c] pb-4">
          <div className="flex items-center gap-2.5">
            <Settings className="size-5 text-[#d97706]" />
            <h2 className="text-base font-semibold text-[#fafaf9]">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#a8a29e] hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Account section */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a8a29e]">
              Account
            </h3>
            <div className="flex items-center justify-between rounded-xl border border-[#32302c] bg-[#22211e] p-3.5">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-[#2e2d29] text-[#ececec]">
                  <User className="size-4.5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#ececec]">{user?.name || "Guest"}</p>
                  <p className="text-[11px] text-[#78716c]">
                    {isGuest ? "Temporary anonymous workspace" : user?.email}
                  </p>
                </div>
              </div>

              {isGuest ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth?.();
                  }}
                  className="rounded-lg bg-[#d97706] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#b45309]"
                >
                  Sign In
                </button>
              ) : (
                <span className="rounded-md bg-[#2e2d29] px-2 py-0.5 text-[11px] text-[#a8a29e]">
                  {user?.provider}
                </span>
              )}
            </div>
          </div>

          {/* Appearance */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a8a29e]">
              Appearance
            </h3>
            <div className="flex items-center justify-between rounded-xl border border-[#32302c] bg-[#22211e] p-3.5">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="size-4 text-[#d97706]" />
                ) : (
                  <Sun className="size-4 text-amber-500" />
                )}
                <span className="text-xs font-medium text-[#ececec]">Theme</span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg border border-[#383733] bg-[#2a2926] px-3 py-1.5 text-xs text-[#ececec] hover:bg-[#32302c]"
              >
                {theme === "dark" ? "Dark (Claude)" : "Light"}
              </button>
            </div>
          </div>

          {/* Chat history management */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a8a29e]">
              Data Management
            </h3>
            <div className="rounded-xl border border-[#32302c] bg-[#22211e] p-3.5">
              {confirmClear ? (
                <div>
                  <p className="text-xs text-rose-300">
                    Are you sure? This will delete all your conversation history.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={clearing}
                      onClick={() => void handleClearChats()}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {clearing ? "Deleting…" : "Yes, clear all"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="rounded-lg border border-[#383733] px-3 py-1.5 text-xs text-[#a8a29e] hover:bg-[#2a2926]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#ececec]">Clear Conversations</p>
                    <p className="text-[11px] text-[#78716c]">Remove all chat sessions</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-950/40"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Clear all</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Logout */}
          {!isGuest && (
            <div className="border-t border-[#32302c] pt-4">
              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await logout();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-900/40 bg-rose-950/20 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-950/40"
              >
                <LogOut className="size-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
