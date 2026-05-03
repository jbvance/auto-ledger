import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { validateMobileEnv } from "@autoledger/config";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState } from "react-native";

const mobileEnv = validateMobileEnv({
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
});

export const isSupabaseConfigured = Boolean(
  mobileEnv.url && mobileEnv.anonKey,
);

export const supabase = isSupabaseConfigured
  ? createClient(mobileEnv.url!, mobileEnv.anonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        lock: processLock,
        persistSession: true,
        storage: AsyncStorage,
      },
    })
  : null;

export const isInvalidRefreshTokenError = (error: unknown) =>
  error instanceof Error &&
  error.message.toLowerCase().includes("invalid refresh token");

export const clearStoredSupabaseSession = async () => {
  if (!supabase) {
    return;
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error: unknown) {
    console.warn("Unable to clear stale Supabase auth session.", error);
  }
};

const handleAuthRefreshError = async (error: unknown) => {
  if (isInvalidRefreshTokenError(error)) {
    await clearStoredSupabaseSession();
    return;
  }

  console.warn("Unable to refresh Supabase auth session.", error);
};

if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh().catch(handleAuthRefreshError);
      return;
    }

    void supabase.auth.stopAutoRefresh().catch(handleAuthRefreshError);
  });
}
