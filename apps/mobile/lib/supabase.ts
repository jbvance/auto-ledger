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

if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
      return;
    }

    void supabase.auth.stopAutoRefresh();
  });
}
