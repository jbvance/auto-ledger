import { validateWebEnv } from "@autoledger/config";

export const getWebSupabaseConfig = () => {
  const env = validateWebEnv({
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  return {
    anonKey: env.anonKey,
    isConfigured: Boolean(env.url && env.anonKey),
    url: env.url,
  };
};
