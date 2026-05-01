import { publicSupabaseEnvSchema } from "@autoledger/validation";

export const validateMobileEnv = (env: Record<string, string | undefined>) =>
  publicSupabaseEnvSchema.parse({
    url: env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });

export const validateWebEnv = (env: Record<string, string | undefined>) =>
  publicSupabaseEnvSchema.parse({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
