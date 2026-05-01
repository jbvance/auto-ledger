import { z } from "zod";

export const optionalUrlSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

export const optionalSecretSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

export const publicSupabaseEnvSchema = z.object({
  url: optionalUrlSchema,
  anonKey: optionalSecretSchema,
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;
