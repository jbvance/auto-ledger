import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { supabase } from "./supabase";

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  signIn: (input: EmailPasswordInput) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  signUp: (input: EmailPasswordInput) => Promise<AuthResult>;
  user: User | null;
};

type EmailPasswordInput = {
  email: string;
  password: string;
};

type AuthResult = {
  error?: string;
  needsEmailConfirmation?: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async ({ email, password }: EmailPasswordInput) => {
    if (!supabase) {
      return {
        error:
          "Supabase is not configured. Add the public Supabase URL and anon key to your environment.",
      };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async ({ email, password }: EmailPasswordInput) => {
    if (!supabase) {
      return {
        error:
          "Supabase is not configured. Add the public Supabase URL and anon key to your environment.",
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return {
        error:
          "Supabase is not configured. Add the public Supabase URL and anon key to your environment.",
      };
    }

    const { error } = await supabase.auth.signOut();

    return error ? { error: error.message } : {};
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: Boolean(supabase),
      isLoading,
      session,
      signIn,
      signOut,
      signUp,
      user: session?.user ?? null,
    }),
    [isLoading, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
