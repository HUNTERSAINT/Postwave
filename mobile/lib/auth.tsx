import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, loadToken, saveToken, setUnauthorizedHandler, type User } from "./api";

type AuthState = { user: User | null; ready: boolean; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void> };
const Ctx = createContext<AuthState>({ user: null, ready: false, signIn: async () => {}, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => {
    try { await api.post("/api/auth/logout"); } catch { /* ignore */ }
    await saveToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { void saveToken(null); setUser(null); });
    (async () => {
      const token = await loadToken();
      if (token) {
        try { const r = await api.get<{ user: User | null }>("/api/auth/me"); setUser(r.user); } catch { /* offline: stay signed out */ }
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: User; token: string }>("/api/auth/login", { email, password });
    await saveToken(r.token);
    setUser(r.user);
  }, []);

  return <Ctx.Provider value={{ user, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}
