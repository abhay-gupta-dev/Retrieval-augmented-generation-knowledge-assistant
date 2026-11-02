import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon, X } from "lucide-react";

import { useAuth } from "../context/AuthContext";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup";
};

export function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { signIn, signUp, loginWithGoogle, isLoading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">(defaultTab);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (tab === "signup") {
      if (!name.trim()) {
        setError("Please provide your full name.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      setSubmitting(true);
      try {
        await signUp(name.trim(), email.trim(), password);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
      } finally {
        setSubmitting(false);
      }
    } else {
      setSubmitting(true);
      try {
        await signIn(email.trim(), password);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to sign in. Please verify your credentials.");
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#32302c] bg-[#1c1b18] p-7 shadow-2xl text-[#ececec]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#a8a29e] transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>

        {/* Tab switch */}
        <div className="mb-6 flex border-b border-[#32302c]">
          <button
            type="button"
            onClick={() => { setTab("signin"); setError(""); }}
            className={`flex-1 pb-3 text-center text-sm font-medium transition ${
              tab === "signin"
                ? "border-b-2 border-[#d97706] text-[#fafaf9]"
                : "text-[#a8a29e] hover:text-[#ececec]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab("signup"); setError(""); }}
            className={`flex-1 pb-3 text-center text-sm font-medium transition ${
              tab === "signup"
                ? "border-b-2 border-[#d97706] text-[#fafaf9]"
                : "text-[#a8a29e] hover:text-[#ececec]"
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a8a29e]">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#78716c]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full rounded-xl border border-[#32302c] bg-[#242320] py-2.5 pl-10 pr-3.5 text-sm text-[#ececec] placeholder:text-[#78716c] focus:border-[#d97706] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a8a29e]">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#78716c]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-[#32302c] bg-[#242320] py-2.5 pl-10 pr-3.5 text-sm text-[#ececec] placeholder:text-[#78716c] focus:border-[#d97706] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a8a29e]">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#78716c]" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#32302c] bg-[#242320] py-2.5 pl-10 pr-10 text-sm text-[#ececec] placeholder:text-[#78716c] focus:border-[#d97706] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716c] hover:text-[#ececec]"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {tab === "signup" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a8a29e]">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#78716c]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#32302c] bg-[#242320] py-2.5 pl-10 pr-10 text-sm text-[#ececec] placeholder:text-[#78716c] focus:border-[#d97706] focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97706] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b45309] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{tab === "signup" ? "Creating account…" : "Signing in…"}</span>
              </>
            ) : tab === "signup" ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#32302c]" />
          <span className="text-xs uppercase tracking-wider text-[#78716c]">or</span>
          <div className="h-px flex-1 bg-[#32302c]" />
        </div>

        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={submitting || isLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#32302c] bg-[#242320] py-2.5 text-sm font-medium text-[#ececec] transition hover:bg-[#2b2a26]"
        >
          <svg className="size-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
