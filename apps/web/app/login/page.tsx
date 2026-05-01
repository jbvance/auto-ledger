"use client";

import { appName } from "@autoledger/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getWebSupabaseConfig } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { isConfigured } = getWebSupabaseConfig();
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  const signIn = async () => {
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div>
          <Link className="text-xl font-bold" href="/">
            {appName}
          </Link>
          <p className="mt-6 text-sm font-bold uppercase text-[var(--primary)]">
            Optional account
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">Sign in</h1>
          <p className="mt-3 text-base leading-7 text-[var(--muted)]">
            Cloud sync is not active yet. Mobile guest records remain local
            until migration and sync are implemented.
          </p>
        </div>

        {!isConfigured ? (
          <InfoBox text="Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable web sign-in." />
        ) : (
          <form
            className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            <AuthField
              label="Email"
              onChange={setEmail}
              type="email"
              value={email}
            />
            <AuthField
              label="Password"
              onChange={setPassword}
              type="password"
              value={password}
            />

            {feedback ? <InfoBox text={feedback} /> : null}

            <button
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
            <Link
              className="block rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-center text-sm font-bold text-[var(--foreground)]"
              href="/signup"
            >
              Create account
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}

function AuthField({
  label,
  onChange,
  type,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type: "email" | "password";
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-[var(--foreground)]">
        {label}
      </span>
      <input
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)]"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
      <p className="text-sm leading-6 text-[var(--muted)]">{text}</p>
    </div>
  );
}
