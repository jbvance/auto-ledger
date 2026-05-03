import {
  formatAttachmentFileSize,
  formatAttachmentTypeLabel,
  formatCostAmount,
  formatDisplayDate,
  formatMaintenanceReminderCategory,
  formatOdometer,
  formatVehicleSubtitle,
  formatVehicleTitle,
  getAttachmentDisplayName,
  getMaintenanceReminderStatus,
  maintenanceReminderTypeLabels,
  odometerSourceTypeLabels,
  repairRecordCategoryLabels,
  serviceRecordCategoryLabels,
  vehicleTypeLabels,
  type MaintenanceReminder,
  type RecordAttachment,
  type Vehicle,
  type VehicleHistoryItem,
} from "@autoledger/shared";
import Link from "next/link";

import { SignOutButton } from "../../../components/SignOutButton";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../lib/cloud/serverData";

type VehicleDetailPageProps = {
  params: Promise<{
    vehicleId: string;
  }>;
};

export default async function VehicleDetailPage({
  params,
}: VehicleDetailPageProps) {
  const { vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <PageShell>
        <AuthPrompt message={authState.errorMessage} />
      </PageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let detail: Awaited<ReturnType<typeof loadWebCloudVehicleDetail>> | null =
    null;
  let loadError: string | null = null;

  try {
    detail = await loadWebCloudVehicleDetail({
      userId: authState.user.id,
      vehicleId,
    });
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Unable to load this cloud vehicle.";
  }

  if (loadError) {
    return (
      <PageShell userEmail={userEmail}>
        <ErrorPanel message={loadError} />
      </PageShell>
    );
  }

  if (!detail) {
    return (
      <PageShell userEmail={userEmail}>
        <NotFoundPanel />
      </PageShell>
    );
  }

  return (
    <PageShell userEmail={userEmail}>
      <section className="flex flex-col gap-3 border-b border-[var(--line)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="text-sm font-bold text-[var(--primary)]"
            href="/vehicles"
          >
            Vehicles
          </Link>
          <span className="text-sm text-[var(--muted)]">/</span>
          <span className="text-sm font-semibold text-[var(--muted)]">
            Cloud detail
          </span>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--primary)]">
              {detail.vehicle.archived_at
                ? "Archived cloud vehicle"
                : "Cloud vehicle"}
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight">
              {formatVehicleTitle(detail.vehicle)}
            </h1>
            <p className="mt-2 text-base leading-7 text-[var(--muted)]">
              {formatVehicleSubtitle(detail.vehicle)}
            </p>
          </div>
          <Link
            className="rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
            href="/dashboard"
          >
            Dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <VehicleDetailsCard vehicle={detail.vehicle} />
        <RecordSummaryCard
          attachmentCount={detail.attachments.length}
          historyCount={detail.historyItems.length}
          reminderCount={detail.maintenanceReminders.length}
        />
      </section>

      <HistorySection
        historyItems={detail.historyItems}
        vehicle={detail.vehicle}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <OdometerSection
          entries={detail.odometerEntries}
          vehicle={detail.vehicle}
        />
        <ReminderSection
          reminders={detail.maintenanceReminders}
          vehicle={detail.vehicle}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RecordSection
          emptyMessage="No cloud service records yet."
          records={detail.serviceRecords}
          type="service"
          vehicle={detail.vehicle}
        />
        <RecordSection
          emptyMessage="No cloud repair records yet."
          records={detail.repairRecords}
          type="repair"
          vehicle={detail.vehicle}
        />
      </section>

      <AttachmentSection attachments={detail.attachments} />
    </PageShell>
  );
}

function VehicleDetailsCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">Vehicle Details</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Detail label="Current odometer">
          {formatOdometer(vehicle.current_odometer, vehicle.odometer_unit)}
        </Detail>
        <Detail label="Vehicle type">
          {vehicleTypeLabels[vehicle.vehicle_type]}
        </Detail>
        <Detail label="Color">{vehicle.color ?? "Not set"}</Detail>
        <Detail label="VIN">{vehicle.vin ?? "Not set"}</Detail>
        <Detail label="License plate">
          {vehicle.license_plate ?? "Not set"}
        </Detail>
        <Detail label="License state">
          {vehicle.license_state ?? "Not set"}
        </Detail>
        <Detail label="Purchase date">
          {vehicle.purchase_date
            ? formatDisplayDate(vehicle.purchase_date)
            : "Not set"}
        </Detail>
        <Detail label="Purchase odometer">
          {vehicle.purchase_odometer === null ||
          vehicle.purchase_odometer === undefined
            ? "Not set"
            : formatOdometer(vehicle.purchase_odometer, vehicle.odometer_unit)}
        </Detail>
      </div>
      {vehicle.notes ? (
        <p className="mt-4 rounded-lg bg-[var(--background)] p-3 text-sm leading-6 text-[var(--muted)]">
          {vehicle.notes}
        </p>
      ) : null}
    </section>
  );
}

function RecordSummaryCard({
  attachmentCount,
  historyCount,
  reminderCount,
}: {
  attachmentCount: number;
  historyCount: number;
  reminderCount: number;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">Cloud Records</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        This page shows account data stored in Supabase only. Local mobile guest
        records are not mixed into web views.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="history items" value={historyCount} />
        <Stat label="reminders" value={reminderCount} />
        <Stat label="attachments" value={attachmentCount} />
      </div>
    </section>
  );
}

function HistorySection({
  historyItems,
  vehicle,
}: {
  historyItems: VehicleHistoryItem[];
  vehicle: Vehicle;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">Recent History</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        Odometer, service, and repair records for this cloud vehicle.
      </p>
      {historyItems.length === 0 ? (
        <EmptyText>No cloud history yet.</EmptyText>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {historyItems.map((item) => (
            <HistoryCard
              item={item}
              key={`${item.type}-${item.id}`}
              vehicle={vehicle}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OdometerSection({
  entries,
  vehicle,
}: {
  entries: Array<{
    id: string;
    notes?: null | string;
    reading: number;
    reading_date: string;
    source_type: keyof typeof odometerSourceTypeLabels;
  }>;
  vehicle: Vehicle;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">Odometer Entries</h2>
      {entries.length === 0 ? (
        <EmptyText>No cloud odometer entries yet.</EmptyText>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {entries.slice(0, 8).map((entry) => (
            <div
              className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3"
              key={entry.id}
            >
              <p className="font-bold">
                {formatOdometer(entry.reading, vehicle.odometer_unit)}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {formatDisplayDate(entry.reading_date)} ·{" "}
                {odometerSourceTypeLabels[entry.source_type]}
              </p>
              {entry.notes ? (
                <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
                  {entry.notes}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReminderSection({
  reminders,
  vehicle,
}: {
  reminders: MaintenanceReminder[];
  vehicle: Vehicle;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">Maintenance Reminders</h2>
      {reminders.length === 0 ? (
        <EmptyText>No cloud reminders yet.</EmptyText>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {reminders.slice(0, 8).map((reminder) => {
            const status = getMaintenanceReminderStatus({
              currentOdometer: vehicle.current_odometer,
              reminder,
            });

            return (
              <div
                className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3"
                key={reminder.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{reminder.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatMaintenanceReminderCategory(reminder.category)} ·{" "}
                      {maintenanceReminderTypeLabels[reminder.reminder_type]}
                    </p>
                  </div>
                  <span className="rounded-md bg-[var(--surface)] px-2 py-1 text-xs font-bold uppercase text-[var(--muted)]">
                    {status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {reminder.due_date
                    ? formatDisplayDate(reminder.due_date)
                    : "No due date"}
                  {reminder.due_odometer === null ||
                  reminder.due_odometer === undefined
                    ? ""
                    : ` · Due ${formatOdometer(reminder.due_odometer, vehicle.odometer_unit)}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecordSection({
  emptyMessage,
  records,
  type,
  vehicle,
}: {
  emptyMessage: string;
  records: Array<
    {
      category: string;
      cost_amount?: null | number;
      cost_currency: string;
      id: string;
      odometer_reading?: null | number;
      title: string;
      vendor_name?: null | string;
    } & ({ repair_date: string } | { service_date: string })
  >;
  type: "repair" | "service";
  vehicle: Vehicle;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">
        {type === "service" ? "Service Records" : "Repair Records"}
      </h2>
      {records.length === 0 ? (
        <EmptyText>{emptyMessage}</EmptyText>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {records.slice(0, 8).map((record) => {
            const recordDate =
              "service_date" in record
                ? record.service_date
                : record.repair_date;
            const categoryLabel =
              type === "service"
                ? serviceRecordCategoryLabels[
                    record.category as keyof typeof serviceRecordCategoryLabels
                  ]
                : repairRecordCategoryLabels[
                    record.category as keyof typeof repairRecordCategoryLabels
                  ];

            return (
              <div
                className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3"
                key={record.id}
              >
                <p className="font-bold">{record.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {formatDisplayDate(recordDate)} · {categoryLabel}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {record.odometer_reading === null ||
                  record.odometer_reading === undefined ? null : (
                    <SmallBadge>
                      {formatOdometer(
                        record.odometer_reading,
                        vehicle.odometer_unit,
                      )}
                    </SmallBadge>
                  )}
                  {record.cost_amount === null ||
                  record.cost_amount === undefined ? null : (
                    <SmallBadge>
                      {formatCostAmount(
                        record.cost_amount,
                        record.cost_currency,
                      )}
                    </SmallBadge>
                  )}
                  {record.vendor_name ? (
                    <SmallBadge>{record.vendor_name}</SmallBadge>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AttachmentSection({
  attachments,
}: {
  attachments: RecordAttachment[];
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">Service and Repair Attachments</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        Display-only metadata for private cloud attachments. Opening signed
        attachment links is deferred.
      </p>
      {attachments.length === 0 ? (
        <EmptyText>No cloud attachments for this vehicle yet.</EmptyText>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {attachments.map((attachment) => (
            <div
              className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3"
              key={attachment.id}
            >
              <p className="font-bold">
                {getAttachmentDisplayName(attachment)}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {formatAttachmentTypeLabel(attachment.file_type)} ·{" "}
                {formatAttachmentFileSize(attachment.file_size_bytes)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryCard({
  item,
  vehicle,
}: {
  item: VehicleHistoryItem;
  vehicle: Vehicle;
}) {
  const odometerUnit =
    item.type === "odometer"
      ? item.source.odometer_unit
      : vehicle.odometer_unit;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--primary)]">
            {item.typeLabel}
          </p>
          <h3 className="mt-1 text-base font-bold">{item.title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {formatDisplayDate(item.date)}
          </p>
        </div>
        {item.categoryLabel ? (
          <SmallBadge>{item.categoryLabel}</SmallBadge>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.odometer_reading === null ||
        item.odometer_reading === undefined ? null : (
          <SmallBadge>
            {formatOdometer(item.odometer_reading, odometerUnit)}
          </SmallBadge>
        )}
        {item.cost_amount === null || item.cost_amount === undefined ? null : (
          <SmallBadge>
            {formatCostAmount(item.cost_amount, item.cost_currency)}
          </SmallBadge>
        )}
        {item.vendor_name ? <SmallBadge>{item.vendor_name}</SmallBadge> : null}
      </div>
      {item.summary ? (
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {item.summary}
        </p>
      ) : null}
    </div>
  );
}

function Detail({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="border-b border-[var(--line)] pb-3">
      <p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--foreground)]">
        {children}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--background)] p-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase leading-4 text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

function SmallBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--surface)] px-2 py-1 text-xs font-bold uppercase text-[var(--muted)]">
      {children}
    </span>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg bg-[var(--background)] p-3">
      <p className="text-sm leading-6 text-[var(--muted)]">{children}</p>
    </div>
  );
}

function AuthPrompt({ message }: { message: string | null }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Sign in to view this vehicle</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {message ??
          "Vehicle detail pages show cloud account data only. Sign in to continue."}
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

function NotFoundPanel() {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Vehicle not found</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        This cloud vehicle may have been deleted, or it may belong to another
        account.
      </p>
      <Link
        className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
        href="/vehicles"
      >
        Back to vehicles
      </Link>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-[var(--surface)] p-6">
      <h1 className="text-2xl font-bold">Vehicle unavailable</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{message}</p>
    </section>
  );
}

function PageShell({
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
