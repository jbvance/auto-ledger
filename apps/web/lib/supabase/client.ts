import { createBrowserClient } from "@supabase/ssr";

import { getWebSupabaseConfig } from "./config";

export function createClient() {
  const { anonKey, isConfigured, url } = getWebSupabaseConfig();

  if (!isConfigured || !url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient(url, anonKey);
}
