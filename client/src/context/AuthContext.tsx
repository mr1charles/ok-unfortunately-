import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { getToken, setToken } from "../api/client";
import type { Me } from "../types";

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  isAuthed: boolean;
  isAdmin: boolean;
  login: (emailOrUsername: string, password: string) => Promise<Me>;
  register: (email: string, username: string, password: string) => Promise<Me>;
  logout: () => void;
  refresh: () => Promise<void>;
  setMe: (me: Me) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMeState(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await authApi.fetchMe();
      setMeState(user);
    } catch {
      setToken(null);
      setMeState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const { token, user } = await authApi.login({ emailOrUsername, password });
    setToken(token);
    setMeState(user);
    return user;
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const { token, user } = await authApi.register({ email, username, password });
    setToken(token);
    setMeState(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setMeState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        me,
        loading,
        isAuthed: !!me,
        isAdmin: me?.role === "ADMIN",
        login,
        register,
        logout,
        refresh,
        setMe: setMeState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
