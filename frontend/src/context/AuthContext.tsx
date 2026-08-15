import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AUTH_LOGOUT_EVENT, TOKEN_STORAGE_KEY, fetchMe, login as apiLogin, signup as apiSignup } from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  // True only while the very first "is there a valid token?" check is in
  // flight on page load - lets ProtectedRoute avoid a flash-redirect to
  // /login before that check has had a chance to resolve.
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Only actually "initializing" if there's a token to validate - otherwise
  // there's nothing to wait on, so start already settled.
  const [initializing, setInitializing] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) return;

    fetchMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_STORAGE_KEY))
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    function handleLogout() {
      setUser(null);
    }
    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout);
  }, []);

  async function login(email: string, password: string) {
    const data = await apiLogin(email, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    setUser(data.user);
  }

  async function signup(email: string, password: string) {
    const data = await apiSignup(email, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, initializing, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
