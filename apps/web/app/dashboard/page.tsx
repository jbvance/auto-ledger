import { appName } from "@autoledger/shared";
import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "../../components/SignOutButton";
import { getWebSupabaseConfig } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";

export default async function DashboardPage() {
  const { isConfigured } = getWebSupabaseConfig();
  const user = isConfigured
    ? await createClient().then((supabase) =>
        supabase.auth.getUser().then(({ data }) => data.user),
      )
    : null;

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <Link className="text-xl font-bold" href="/">
            {appName}
          </Link>
          <p className="mt-6 text-sm font-bold uppercase text-[var(--primary)]">
            Account dashboard
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Cloud sync foundation
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
            This page verifies Supabase Auth sessions on the web. Vehicle
            records, reminders, attachments, and exports are not synced here
            yet.
          </p>
        </div>

        {!isConfigured ? (
          <StatusPanel
            action={
              <Link
                className="inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
                href="/"
              >
                Back home
              </Link>
            }
            title="Supabase is not configured"
          >
            Add `NEXT_PUBLIC_SUPABASE_URL` and
            `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable web accounts.
          </StatusPanel>
        ) : user ? (
          <StatusPanel action={<SignOutButton />} title="Signed in">
            {user.email ?? "Your account"} is authenticated. Cloud sync,
            guest-to-account migration, and cloud storage are intentionally
            deferred.
          </StatusPanel>
        ) : (
          <StatusPanel
            action={
              <div className="flex flex-wrap gap-3">
                <Link
                  className="rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
                  href="/login"
                >
                  Sign in
                </Link>
                <Link
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--foreground)]"
                  href="/signup"
                >
                  Create account
                </Link>
              </div>
            }
            title="Guest view"
          >
            You are not signed in. Account creation is optional, and cloud sync
            is not active yet.
          </StatusPanel>
        )}
      </div>
    </main>
  );
}

function StatusPanel({
  action,
  children,
  title,
}: {
  action: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{children}</p>
      <div className="mt-4">{action}</div>
    </section>
  );
}
