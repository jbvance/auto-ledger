import { publicSupabaseEnvSchema } from "@autoledger/validation";

const normalizeSupabaseProjectUrl = (url: string | undefined) =>
  url?.trim().match(/^(https?:\/\/[^/]+)/)?.[1] ?? url;

export const validateMobileEnv = (env: Record<string, string | undefined>) => {
  const parsed = publicSupabaseEnvSchema.parse({
    url: env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });

  return {
    ...parsed,
    url: normalizeSupabaseProjectUrl(parsed.url),
  };
};

export const validateWebEnv = (env: Record<string, string | undefined>) => {
  const parsed = publicSupabaseEnvSchema.parse({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return {
    ...parsed,
    url: normalizeSupabaseProjectUrl(parsed.url),
  };
};
