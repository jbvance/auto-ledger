import Link from "next/link";

import { SignOutButton } from "./SignOutButton";

export function AccountPageShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: null | string;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link className="text-xl font-bold" href="/">
            AutoLedger
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--foreground)]"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--foreground)]"
              href="/vehicles"
            >
              Vehicles
            </Link>
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--foreground)]"
              href="/settings/export"
            >
              Export
            </Link>
            {userEmail ? (
              <>
                <span className="hidden text-sm font-semibold text-[var(--muted)] md:inline">
                  {userEmail}
                </span>
                <SignOutButton />
              </>
            ) : null}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}

export function AccountAuthPrompt({
  defaultMessage,
  message,
  title,
}: {
  defaultMessage: string;
  message: null | string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {message ?? defaultMessage}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          className="rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
          href="/login"
        >
          Sign in
        </Link>
        <Link
          className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm font-bold text-[var(--foreground)]"
          href="/signup"
        >
          Create account
        </Link>
      </div>
    </section>
  );
}

export function AccountErrorPanel({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-red-200 bg-[var(--surface)] p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{message}</p>
    </section>
  );
}
