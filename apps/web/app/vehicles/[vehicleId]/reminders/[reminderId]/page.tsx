import {
  formatDisplayDate,
  formatMaintenanceReminderCategory,
  formatOdometer,
  getMaintenanceReminderStatus,
  maintenanceReminderStatusLabels,
  maintenanceReminderTypeLabels,
} from "@autoledger/shared";
import { Pencil } from "lucide-react";
import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../../components/AccountPageChrome";
import {
  MaintenanceReminderCompleteForm,
  MaintenanceReminderDeleteForm,
} from "../../../../../components/MaintenanceReminderForm";
import { getWebCloudMaintenanceReminder } from "../../../../../lib/cloud/maintenanceReminderMutations";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../../lib/cloud/serverData";
import {
  completeMaintenanceReminderAction,
  deleteMaintenanceReminderAction,
} from "../../../reminderActions";

type MaintenanceReminderDetailPageProps = {
  params: Promise<{
    reminderId: string;
    vehicleId: string;
  }>;
};

export default async function MaintenanceReminderDetailPage({
  params,
}: MaintenanceReminderDetailPageProps) {
  const { reminderId, vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Reminder pages show cloud account data only. Sign in to view this cloud maintenance reminder."
          message={authState.errorMessage}
          title="Sign in to view this reminder"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let detail: Awaited<ReturnType<typeof loadWebCloudVehicleDetail>> | null =
    null;
  let reminder: Awaited<ReturnType<typeof getWebCloudMaintenanceReminder>> =
    null;
  let loadError: null | string = null;

  try {
    [detail, reminder] = await Promise.all([
      loadWebCloudVehicleDetail({
        userId: authState.user.id,
        vehicleId,
      }),
      getWebCloudMaintenanceReminder({
        reminderId,
        userId: authState.user.id,
        vehicleId,
      }),
    ]);
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Unable to load this cloud maintenance reminder.";
  }

  if (loadError) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <AccountErrorPanel message={loadError} title="Reminder unavailable" />
      </AccountPageShell>
    );
  }

  if (!detail || !reminder || reminder.vehicle_id !== detail.vehicle.id) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <NotFoundPanel vehicleId={vehicleId} />
      </AccountPageShell>
    );
  }

  const canMutate = !detail.vehicle.archived_at;
  const status = getMaintenanceReminderStatus({
    currentOdometer: detail.vehicle.current_odometer,
    reminder,
  });

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
          <Link
            className="text-sm font-bold text-[var(--primary)]"
            href={`/vehicles/${detail.vehicle.id}`}
          >
            {detail.vehicle.nickname}
          </Link>
          <span className="text-sm text-[var(--muted)]">/</span>
          <span className="text-sm font-semibold text-[var(--muted)]">
            Reminder
          </span>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--primary)]">
              Cloud reminder
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight">
              {reminder.title}
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
              {formatMaintenanceReminderCategory(reminder.category)} reminder
              for {detail.vehicle.nickname}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canMutate ? (
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
                href={`/vehicles/${detail.vehicle.id}/reminders/${reminder.id}/edit`}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Edit Reminder
              </Link>
            ) : null}
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-sm font-bold text-[var(--foreground)]"
              href={`/vehicles/${detail.vehicle.id}#maintenance-reminders`}
            >
              Back to Vehicle
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-bold">Reminder Details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Status">
              {maintenanceReminderStatusLabels[status]}
            </Detail>
            <Detail label="Type">
              {maintenanceReminderTypeLabels[reminder.reminder_type]}
            </Detail>
            <Detail label="Category">
              {formatMaintenanceReminderCategory(reminder.category)}
            </Detail>
            <Detail label="Due date">
              {reminder.due_date
                ? formatDisplayDate(reminder.due_date)
                : "Not set"}
            </Detail>
            <Detail label="Due odometer">
              {reminder.due_odometer === null ||
              reminder.due_odometer === undefined
                ? "Not set"
                : formatOdometer(
                    reminder.due_odometer,
                    detail.vehicle.odometer_unit,
                  )}
            </Detail>
            <Detail label="Repeat months">
              {reminder.repeat_interval_months ?? "Not set"}
            </Detail>
            <Detail label={`Repeat ${detail.vehicle.odometer_unit}`}>
              {reminder.repeat_interval_miles === null ||
              reminder.repeat_interval_miles === undefined
                ? "Not set"
                : formatOdometer(
                    reminder.repeat_interval_miles,
                    detail.vehicle.odometer_unit,
                  )}
            </Detail>
            <Detail label="Completed">
              {reminder.is_completed ? "Yes" : "No"}
            </Detail>
            <Detail label="Completed at">
              {reminder.completed_at
                ? new Date(reminder.completed_at).toLocaleString("en-US")
                : "Not completed"}
            </Detail>
            <Detail label="Created">
              {new Date(reminder.created_at).toLocaleString("en-US")}
            </Detail>
            <Detail label="Updated">
              {new Date(reminder.updated_at).toLocaleString("en-US")}
            </Detail>
          </div>
          {reminder.notes ? (
            <div className="mt-5 rounded-lg bg-[var(--background)] p-4">
              <p className="text-xs font-bold uppercase text-[var(--muted)]">
                Notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                {reminder.notes}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-bold">Actions</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Changes save to your Supabase account only. Local mobile guest data
            and local notification schedules are not changed from the web.
          </p>
          {canMutate ? (
            <div className="mt-4 flex flex-col gap-4">
              {reminder.is_completed ? null : (
                <MaintenanceReminderCompleteForm
                  action={completeMaintenanceReminderAction}
                  reminderId={reminder.id}
                  vehicleId={detail.vehicle.id}
                />
              )}
              <MaintenanceReminderDeleteForm
                action={deleteMaintenanceReminderAction}
                reminderId={reminder.id}
                vehicleId={detail.vehicle.id}
              />
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-[var(--background)] p-3 text-sm leading-6 text-[var(--muted)]">
              Restore this cloud vehicle before editing, completing, or
              deleting reminders.
            </p>
          )}
        </section>
      </section>
    </AccountPageShell>
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

function NotFoundPanel({ vehicleId }: { vehicleId: string }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Reminder not found</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        This cloud maintenance reminder may have been deleted, or it may belong
        to another account.
      </p>
      <Link
        className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
        href={`/vehicles/${vehicleId}`}
      >
        Back to vehicle
      </Link>
    </section>
  );
}
