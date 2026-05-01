import { appName, statusNavigation } from "@autoledger/shared";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-6 md:flex-row md:py-10">
        <aside className="md:w-56">
          <div className="text-xl font-bold">{appName}</div>
          <nav className="mt-6 flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {statusNavigation.map((item) => (
              <a
                key={item.label}
                className="whitespace-nowrap rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
                href={`#${item.label.toLowerCase()}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <section className="flex-1">
          <div className="border-b border-[var(--line)] pb-6">
            <p className="text-sm font-bold uppercase text-[var(--primary)]">
              Local guest MVP status
            </p>
            <h1 className="mt-2 max-w-2xl text-4xl font-bold leading-tight">
              A quiet, mobile-first home for private vehicle records.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Foundation, mobile guest records, local reminders, attachments,
              and CSV export are working. Cloud account and sync work is next.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {statusNavigation.map((item) => (
              <article
                id={item.label.toLowerCase()}
                key={item.label}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
              >
                <h2 className="text-lg font-bold">{item.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {item.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-bold">Privacy Posture</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Guest mode stays first. Supabase auth, cloud tables, cloud sync,
              account workflows, and cloud attachment storage are not
              implemented yet.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
