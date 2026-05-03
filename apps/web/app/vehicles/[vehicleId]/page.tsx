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
  type OdometerEntry,
  type RecordAttachment,
  type Vehicle,
  type VehicleHistoryItem,
} from "@autoledger/shared";
import { Eye, Pencil, Plus } from "lucide-react";
import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../components/AccountPageChrome";
import { VehicleArchiveRestoreForm } from "../../../components/VehicleArchiveRestoreForm";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../lib/cloud/serverData";
import { archiveVehicleAction, restoreVehicleAction } from "../actions";

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
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Vehicle detail pages show cloud account data only. Sign in to continue."
          message={authState.errorMessage}
          title="Sign in to view this vehicle"
        />
      </AccountPageShell>
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
      <AccountPageShell userEmail={userEmail}>
        <AccountErrorPanel message={loadError} title="Vehicle unavailable" />
      </AccountPageShell>
    );
  }

  if (!detail) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <NotFoundPanel />
      </AccountPageShell>
    );
  }

  return (
    <AccountPageShell userEmail={userEmail}>
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
          <VehicleActions vehicle={detail.vehicle} />
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
          addHref={`/vehicles/${detail.vehicle.id}/service-records/new`}
          canMutate={!detail.vehicle.archived_at}
          emptyMessage="No cloud service records yet."
          records={detail.serviceRecords}
          type="service"
          vehicle={detail.vehicle}
        />
        <RecordSection
          addHref={`/vehicles/${detail.vehicle.id}/repair-records/new`}
          canMutate={!detail.vehicle.archived_at}
          emptyMessage="No cloud repair records yet."
          records={detail.repairRecords}
          type="repair"
          vehicle={detail.vehicle}
        />
      </section>

      <AttachmentSection attachments={detail.attachments} />
    </AccountPageShell>
  );
}

function VehicleActions({ vehicle }: { vehicle: Vehicle }) {
  const isArchived = Boolean(vehicle.archived_at);

  return (
    <div className="flex flex-wrap gap-3">
      {isArchived ? (
        <VehicleArchiveRestoreForm
          action={restoreVehicleAction}
          label="Restore Vehicle"
          vehicleId={vehicle.id}
        />
      ) : (
        <>
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
            href={`/vehicles/${vehicle.id}/edit`}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Edit Vehicle
          </Link>
          <VehicleArchiveRestoreForm
            action={archiveVehicleAction}
            confirmMessage="Archive this vehicle? Its records will stay in your account."
            label="Archive Vehicle"
            variant="danger"
            vehicleId={vehicle.id}
          />
        </>
      )}
      <Link
        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-sm font-bold text-[var(--foreground)]"
        href="/vehicles"
      >
        Vehicles
      </Link>
    </div>
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
  entries: OdometerEntry[];
  vehicle: Vehicle;
}) {
  const canMutate = !vehicle.archived_at;

  return (
    <section
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
      id="odometer-entries"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Odometer Entries</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Manual cloud mileage readings for this vehicle.
          </p>
        </div>
        {canMutate ? (
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
            href={`/vehicles/${vehicle.id}/odometer/new`}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add Odometer Entry
          </Link>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <div className="mt-4 rounded-lg bg-[var(--background)] p-3">
          <p className="text-sm leading-6 text-[var(--muted)]">
            No cloud odometer entries yet.
          </p>
          {canMutate ? (
            <Link
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--foreground)]"
              href={`/vehicles/${vehicle.id}/odometer/new`}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add Odometer Entry
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {entries.map((entry) => (
            <div
              className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3"
              key={entry.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold">
                    {formatOdometer(entry.reading, entry.odometer_unit)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatDisplayDate(entry.reading_date)} -{" "}
                    {odometerSourceTypeLabels[entry.source_type]}
                  </p>
                </div>
                {canMutate ? (
                  <Link
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-bold text-[var(--foreground)]"
                    href={`/vehicles/${vehicle.id}/odometer/${entry.id}/edit`}
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                    Edit
                  </Link>
                ) : null}
              </div>
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
                      {formatMaintenanceReminderCategory(reminder.category)} -{" "}
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
                    : ` - Due ${formatOdometer(reminder.due_odometer, vehicle.odometer_unit)}`}
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
  addHref,
  canMutate,
  emptyMessage,
  records,
  type,
  vehicle,
}: {
  addHref?: string;
  canMutate: boolean;
  emptyMessage: string;
  records: Array<
    {
      category: string;
      cost_amount?: null | number;
      cost_currency: string;
      description?: null | string;
      id: string;
      notes?: null | string;
      odometer_reading?: null | number;
      title: string;
      vendor_name?: null | string;
      warranty_until_date?: null | string;
      warranty_until_odometer?: null | number;
    } & ({ repair_date: string } | { service_date: string })
  >;
  type: "repair" | "service";
  vehicle: Vehicle;
}) {
  return (
    <section
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
      id={type === "service" ? "service-records" : "repair-records"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {type === "service" ? "Service Records" : "Repair Records"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {type === "service"
              ? "Routine cloud maintenance records for this vehicle."
              : "Non-routine cloud repair records for this vehicle."}
          </p>
        </div>
        {canMutate && addHref ? (
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
            href={addHref}
          >
            <Plus aria-hidden="true" className="size-4" />
            {type === "service" ? "Add Service Record" : "Add Repair Record"}
          </Link>
        ) : null}
      </div>
      {records.length === 0 ? (
        <div className="mt-4 rounded-lg bg-[var(--background)] p-3">
          <p className="text-sm leading-6 text-[var(--muted)]">
            {emptyMessage}
          </p>
          {canMutate && addHref ? (
            <Link
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--foreground)]"
              href={addHref}
            >
              <Plus aria-hidden="true" className="size-4" />
              {type === "service" ? "Add Service Record" : "Add Repair Record"}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {records.slice(0, 8).map((record) => {
            const recordDate =
              "service_date" in record
                ? record.service_date
                : record.repair_date;
            const detailHref =
              type === "service"
                ? `/vehicles/${vehicle.id}/service-records/${record.id}`
                : `/vehicles/${vehicle.id}/repair-records/${record.id}`;
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    {detailHref ? (
                      <Link
                        className="font-bold text-[var(--foreground)] transition hover:text-[var(--primary)]"
                        href={detailHref}
                      >
                        {record.title}
                      </Link>
                    ) : (
                      <p className="font-bold">{record.title}</p>
                    )}
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatDisplayDate(recordDate)} - {categoryLabel}
                    </p>
                  </div>
                  {detailHref ? (
                    <Link
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-bold text-[var(--foreground)]"
                      href={detailHref}
                    >
                      <Eye aria-hidden="true" className="size-4" />
                      View Details
                    </Link>
                  ) : null}
                </div>
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
                  {"warranty_until_date" in record &&
                  record.warranty_until_date ? (
                    <SmallBadge>
                      Warranty {formatDisplayDate(record.warranty_until_date)}
                    </SmallBadge>
                  ) : null}
                  {"warranty_until_odometer" in record &&
                  record.warranty_until_odometer !== null &&
                  record.warranty_until_odometer !== undefined ? (
                    <SmallBadge>
                      Warranty{" "}
                      {formatOdometer(
                        record.warranty_until_odometer,
                        vehicle.odometer_unit,
                      )}
                    </SmallBadge>
                  ) : null}
                </div>
                {record.description || record.notes ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                    {record.description ?? record.notes}
                  </p>
                ) : null}
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
                {formatAttachmentTypeLabel(attachment.file_type)} -{" "}
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
