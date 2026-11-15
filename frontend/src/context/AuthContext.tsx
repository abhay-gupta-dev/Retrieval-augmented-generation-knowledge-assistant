import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import {
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
const explicitLogoutKey = "knowledge-platform:explicit-logout";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async (): Promise<User | null> => {
    const hadGuestSession = window.localStorage.getItem("knowledge-platform:guest-session") === "true";
    const hadAccountSession = window.localStorage.getItem("knowledge-platform:account-session") === "true";
    // Restore in one request. The backend returns a valid access-cookie session
    // directly, or rotates the refresh cookie when the access token expired.
    try {
      const restoredUser = await refreshSession();
      if (restoredUser.provider === "guest") {
        window.localStorage.setItem("knowledge-platform:guest-session", "true");
        window.localStorage.removeItem("knowledge-platform:account-session");
      } else {
        window.localStorage.setItem("knowledge-platform:account-session", "true");
        window.localStorage.removeItem("knowledge-platform:guest-session");
      }
      window.localStorage.removeItem(explicitLogoutKey);
      setUser(restoredUser);
      return restoredUser;
    } catch {
      // Restore only a previously chosen guest workspace; never silently
      // replace an account with a guest session.
      if (hadGuestSession && !hadAccountSession) {
        try {
          const guestUser = await guestLoginRequest();
          setUser(guestUser);
          return guestUser;
        } catch {
          // Leave the user on the account screen if the API is unavailable.
        }
      }
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void loadUser().finally(() => setIsLoading(false));
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    const loggedInUser = await loginRequest({ email, password });
    window.localStorage.removeItem(explicitLogoutKey);
    window.localStorage.setItem("knowledge-platform:account-session", "true");
    window.localStorage.removeItem("knowledge-platform:guest-session");
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<User> => {
    const registeredUser = await registerRequest({ name, email, password });
    window.localStorage.removeItem(explicitLogoutKey);
    window.localStorage.setItem("knowledge-platform:account-session", "true");
    window.localStorage.removeItem("knowledge-platform:guest-session");
    setUser(registeredUser);
    return registeredUser;
  }, []);

  const continueAsGuest = useCallback(async (): Promise<User> => {
    const guestUser = await guestLoginRequest();
    window.localStorage.removeItem(explicitLogoutKey);
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
    window.localStorage.removeItem("knowledge-platform:account-session");
    window.localStorage.removeItem("knowledge-platform:guest-session");
    window.localStorage.setItem(explicitLogoutKey, "true");
    setUser(null);
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
