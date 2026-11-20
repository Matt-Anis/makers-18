"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, apiFetch, User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const current = await apiFetch<User>("/auth/me");
      setUser(current);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<User>("/auth/me")
      .then((current) => {
        if (active) setUser(current);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    const loggedInUser = await apiFetch<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await apiFetch<{ status: string }>("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
