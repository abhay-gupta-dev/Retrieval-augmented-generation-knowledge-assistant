import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import {
  getCurrentUser,
  googleLoginUrl,
  guestLogin as guestLoginRequest,
  loginRequest,
  logoutRequest,
  refreshSession,
  registerRequest,
} from "../services/api";
import type { User } from "../types/auth";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  loginWithGoogle: () => void;
  continueAsGuest: () => Promise<User>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async (): Promise<User | null> => {
    const hadGuestSession = window.localStorage.getItem("knowledge-platform:guest-session") === "true";
    const hadAccountSession = window.localStorage.getItem("knowledge-platform:account-session") === "true";
    // 1. Try restoring existing active session
    try {
      const currentUser = await getCurrentUser();
      if (currentUser.provider === "guest") {
        window.localStorage.setItem("knowledge-platform:guest-session", "true");
        window.localStorage.removeItem("knowledge-platform:account-session");
      } else {
        window.localStorage.setItem("knowledge-platform:account-session", "true");
        window.localStorage.removeItem("knowledge-platform:guest-session");
      }
      setUser(currentUser);
      return currentUser;
    } catch {
      // 2. If access token expired, try refreshing
      try {
        const refreshedUser = await refreshSession();
        if (refreshedUser.provider === "guest") {
          window.localStorage.setItem("knowledge-platform:guest-session", "true");
          window.localStorage.removeItem("knowledge-platform:account-session");
        } else {
          window.localStorage.setItem("knowledge-platform:account-session", "true");
          window.localStorage.removeItem("knowledge-platform:guest-session");
        }
        setUser(refreshedUser);
        return refreshedUser;
      } catch {
        // Access and refresh cookies may be unavailable after browser restart
        // or when switching between localhost and 127.0.0.1. Restore only a
        // previously chosen guest workspace; never silently replace an account.
        if (hadGuestSession && !hadAccountSession) {
          try {
            const guestUser = await guestLoginRequest();
            setUser(guestUser);
            return guestUser;
          } catch {
            // Leave the user on the account screen with the actionable error.
          }
        }
        setUser(null);
        return null;
      }
    }
  }, []);

  useEffect(() => {
    void loadUser().finally(() => setIsLoading(false));
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    const loggedInUser = await loginRequest({ email, password });
    window.localStorage.setItem("knowledge-platform:account-session", "true");
    window.localStorage.removeItem("knowledge-platform:guest-session");
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<User> => {
    const registeredUser = await registerRequest({ name, email, password });
    window.localStorage.setItem("knowledge-platform:account-session", "true");
    window.localStorage.removeItem("knowledge-platform:guest-session");
    setUser(registeredUser);
    return registeredUser;
  }, []);

  const continueAsGuest = useCallback(async (): Promise<User> => {
    const guestUser = await guestLoginRequest();
    window.localStorage.setItem("knowledge-platform:guest-session", "true");
    window.localStorage.removeItem("knowledge-platform:account-session");
    setUser(guestUser);
    return guestUser;
  }, []);

  const loginWithGoogle = useCallback(() => {
    window.location.assign(googleLoginUrl());
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Ignore network failures on logout
    }
    // After logging out of account, start fresh guest workspace
    try {
      const guest = await guestLoginRequest();
      window.localStorage.setItem("knowledge-platform:guest-session", "true");
      window.localStorage.removeItem("knowledge-platform:account-session");
      setUser(guest);
    } catch {
      window.localStorage.removeItem("knowledge-platform:account-session");
      setUser(null);
    }
  }, []);

  const isGuest = Boolean(user && user.provider === "guest");

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isGuest,
      signIn,
      signUp,
      loginWithGoogle,
      continueAsGuest,
      logout,
      getCurrentUser: loadUser,
    }),
    [continueAsGuest, isGuest, isLoading, loadUser, loginWithGoogle, logout, signIn, signUp, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
