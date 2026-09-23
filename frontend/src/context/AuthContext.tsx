import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { getCurrentUser, googleLoginUrl, logoutRequest, refreshSession } from "../services/api";
import type { User } from "../types/auth";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      try {
        const refreshedUser = await refreshSession();
        setUser(refreshedUser);
        return refreshedUser;
      } catch {
        setUser(null);
        return null;
      }
    }
  }, []);

  useEffect(() => {
    loadCurrentUser().finally(() => setIsLoading(false));
  }, [loadCurrentUser]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    login: () => { window.location.assign(googleLoginUrl()); },
    logout: async () => { await logoutRequest(); setUser(null); },
    getCurrentUser: loadCurrentUser,
  }), [isLoading, loadCurrentUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
