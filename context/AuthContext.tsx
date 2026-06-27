// context/AuthContext.tsx

import { getMe, MeResponse } from "@/services/profile";
import {
    clearSavedLoginPersistence,
    clearSessionUser,
    getSessionUser,
    SessionUser,
} from "@/services/session";
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

export type AuthUser = Partial<MeResponse> & Partial<SessionUser>;

type AuthContextValue = {
  user: AuthUser | null;
  loadingUser: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  clearUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const [sessionRes, meRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);
      return mergedUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const clearUser = useCallback(async () => {
    await clearSessionUser();
    await clearSavedLoginPersistence();
    setUser(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const nextUser = await refreshUser();

        if (!mounted) return;
        setUser(nextUser);
      } finally {
        if (mounted) {
          setLoadingUser(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      loadingUser,
      refreshUser,
      clearUser,
    }),
    [clearUser, loadingUser, refreshUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
}