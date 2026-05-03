import Link from "next/link";
import type { ReactNode } from "react";

import type { getWebCloudCsvExportSummary } from "../lib/cloud/exportData";

type WebCloudCsvExportSummary = ReturnType<
  typeof getWebCloudCsvExportSummary
>;

export function AccountDataControls({
  isAuthenticated,
  loadError,
  summary,
  userEmail,
}: {
  isAuthenticated: boolean;
  loadError?: null | string;
  summary?: null | WebCloudCsvExportSummary;
  userEmail?: null | string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 border-b border-[var(--line)] pb-5">
        <p className="text-sm font-bold uppercase text-[var(--primary)]">
          Account & Data
        </p>
        <h1 className="text-4xl font-bold leading-tight">
          Understand and manage your AutoLedger data.
        </h1>
        <p className="max-w-3xl text-base leading-7 text-[var(--muted)]">
          Local guest records are stored on this device. Cloud account records
          are stored in your AutoLedger account. Moving local records to your
          account is optional.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <InfoPanel
          title="Current mode"
          value={isAuthenticated ? "Signed in" : "Not signed in"}
        >
          {isAuthenticated ? (
            <p>{userEmail ?? "Email unavailable"}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p>
                Sign in to view cloud account data. Web settings do not read
                mobile guest records.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white"
                  href="/login"
                >
                  Sign In
                </Link>
                <Link
                  className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm font-bold text-[var(--foreground)]"
                  href="/signup"
                >
                  Create Account
                </Link>
              </div>
            </div>
          )}
        </InfoPanel>
        <InfoPanel title="Local guest data" value="Device only">
          <p>
            Mobile guest records remain on the device where they were created.
            The web app cannot export or delete those records.
          </p>
        </InfoPanel>
        <InfoPanel title="Cloud account data" value="Account data">
          <p>
            Signed-in web pages show Supabase records for your AutoLedger
            account. This is not continuous two-way sync for local guest data.
          </p>
        </InfoPanel>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold">Export cloud account data</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Export before deleting or changing data if you want a copy. Web
              CSV export includes cloud account records and attachment metadata,
              but not attachment file binaries or PDF exports.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
            href="/settings/export"
          >
            Open Cloud CSV Export
          </Link>
        </div>
        {isAuthenticated && summary ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
          </div>
        ) : null}
        {loadError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {loadError}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-bold">Local guest data controls</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Delete local guest data from the mobile app on the device that holds
            it. That flow requires typed confirmation and does not delete cloud
            account data.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-bold">
            Delete account / delete cloud data
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Full cloud data deletion and Supabase Auth account deletion require
            a server-only flow. This destructive control is planned and is not
            active yet.
          </p>
          <button
            className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm font-bold text-[var(--muted)] opacity-70"
            disabled
            type="button"
          >
            Coming soon
          </button>
        </section>
      </section>
    </div>
  );
}

function InfoPanel({
  children,
  title,
  value,
}: {
  children: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <p className="text-xs font-bold uppercase text-[var(--muted)]">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <div className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {children}
      </div>
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase leading-4 text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}
