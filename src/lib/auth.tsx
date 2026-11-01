import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { get, loadToken, post, saveToken, setUnauthorizedHandler } from "./api";

export type Status = "loading" | "signedOut" | "signedIn";
type Session = { token: string; user: { id: string; email: string; name: string } };

type Value = {
  status: Status;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Value | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);

  const clear = useCallback(() => {
    setEmail(null);
    setStatus("signedOut");
    void saveToken(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    let cancelled = false;
    (async () => {
      const saved = await loadToken();
      if (!saved) return !cancelled && setStatus("signedOut");
      try {
        const me = await get<{ user: { email: string } }>("/me");
        if (cancelled) return;
        setEmail(me.user.email);
        setStatus("signedIn");
      } catch (error) {
        // A dead connection keeps the saved sign-in: only a refused session signs out.
        if (cancelled) return;
        if ((error as { status?: number }).status === 401) clear();
        else setStatus("signedIn");
      }
    })();
    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, [clear]);

  const begin = useCallback(async (session: Session) => {
    await saveToken(session.token);
    setEmail(session.user.email);
    setStatus("signedIn");
  }, []);

  const value = useMemo<Value>(
    () => ({
      status,
      email,
      signIn: async (emailInput, password) => {
        const session = await post<Session>("/auth/sign-in", { email: emailInput, password });
        await begin(session);
      },
      register: async (emailInput, password, confirmPassword) => {
        const session = await post<Session>("/auth/register", { email: emailInput, password, confirmPassword });
        await begin(session);
      },
      signOut: async () => {
        try {
          await post("/auth/sign-out");
        } catch {
          // The token is cleared here either way.
        }
        clear();
      },
    }),
    [status, email, begin, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Value {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
