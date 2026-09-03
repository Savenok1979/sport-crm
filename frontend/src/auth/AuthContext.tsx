import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getAuthToken, setAuthToken, setUnauthorizedHandler } from "../api/client";
import type { EmployeeRole } from "../api/types";

export interface EmployeeSession {
  employeeId: string;
  userId: string;
  organizationId: string;
  role: EmployeeRole;
  exp: number;
}

function decodeToken(token: string): EmployeeSession | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  session: EmployeeSession | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<EmployeeSession | null>(() => {
    const token = getAuthToken();
    if (!token) return null;
    const decoded = decodeToken(token);
    if (!decoded || decoded.exp * 1000 < Date.now()) return null;
    return decoded;
  });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setSession(null);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string }>("/auth/login", { email, password });
    setAuthToken(res.token);
    const decoded = decodeToken(res.token);
    setSession(decoded);
  };

  const logout = () => {
    setAuthToken(null);
    setSession(null);
  };

  const value = useMemo(() => ({ session, login, logout }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
