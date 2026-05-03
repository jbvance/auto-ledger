import { AccountPageShell } from "../../../components/AccountPageChrome";

export default function ExportLoading() {
  return (
    <AccountPageShell>
      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="text-sm font-bold uppercase text-[var(--primary)]">
          Cloud account export
        </p>
        <h1 className="mt-2 text-3xl font-bold">Preparing export data...</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Checking the signed-in cloud account for exportable CSV data.
        </p>
      </section>
    </AccountPageShell>
  );
}

