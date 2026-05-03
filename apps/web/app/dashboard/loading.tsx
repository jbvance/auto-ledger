export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="h-8 w-36 rounded-lg bg-[var(--line)]" />
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Loading dashboard
          </p>
        </div>
      </div>
    </main>
  );
}
