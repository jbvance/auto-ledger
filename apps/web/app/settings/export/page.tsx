import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../components/AccountPageChrome";
import { CloudCsvDownloadLinks } from "../../../components/CloudCsvDownloadLinks";
import {
  getWebCloudCsvExportSummary,
  loadWebCloudCsvExportData,
  webCloudCsvExportFiles,
} from "../../../lib/cloud/exportData";
import { getWebCloudAuthState } from "../../../lib/cloud/serverData";

export default async function WebCloudExportPage() {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Export downloads CSV files for signed-in cloud account data only. Sign in to continue."
          message={authState.errorMessage}
          title="Sign in to export cloud data"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let summary: ReturnType<typeof getWebCloudCsvExportSummary> | null = null;
  let loadError: null | string = null;

  try {
    const data = await loadWebCloudCsvExportData({
      userId: authState.user.id,
    });
    summary = getWebCloudCsvExportSummary(data);
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Unable to load cloud export data.";
  }

  if (loadError || !summary) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <AccountErrorPanel
          message={loadError ?? "Unable to load cloud export data."}
          title="Export unavailable"
        />
      </AccountPageShell>
    );
  }

  return (
    <AccountPageShell userEmail={userEmail}>
      <section className="flex flex-col gap-3 border-b border-[var(--line)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="text-sm font-bold text-[var(--primary)]"
            href="/dashboard"
          >
            Dashboard
          </Link>
          <span className="text-sm text-[var(--muted)]">/</span>
          <span className="text-sm font-semibold text-[var(--muted)]">
            Export
          </span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Cloud account export
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Export your cloud account data as CSV files.
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
            Downloads include signed-in Supabase account data only. Web export
            does not read local mobile guest records, does not upload exports
            anywhere, and does not include attachment file binaries.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="vehicles" value={summary.recordCounts.vehicles} />
        <StatCard
          label="odometer entries"
          value={summary.recordCounts.odometerEntries}
        />
        <StatCard
          label="service records"
          value={summary.recordCounts.serviceRecords}
        />
        <StatCard
          label="repair records"
          value={summary.recordCounts.repairRecords}
        />
        <StatCard
          label="reminders"
          value={summary.recordCounts.maintenanceReminders}
        />
        <StatCard
          label="attachment metadata"
          value={summary.recordCounts.attachmentMetadata}
        />
      </section>

      {!summary.hasData ? (
        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-bold">No cloud records found</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            You can still download header-only CSV files as templates. Add cloud
            vehicles or migrate supported mobile guest records from the mobile
            app to export account data later.
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-bold">Export Format</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          This slice uses separate CSV files instead of a zip archive to keep
          downloads simple and dependency-free. Attachment files are not
          included; attachment metadata is exported.
        </p>
      </section>

      <CloudCsvDownloadLinks files={webCloudCsvExportFiles} />

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-bold">Not Included</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Local mobile guest data, attachment file binaries, signed attachment
          URLs, PDF export, account deletion, households, fuel tracking, VIN
          lookup, OCR, payments, and push notifications are intentionally not
          part of this export.
        </p>
      </section>
    </AccountPageShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase leading-4 text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

