import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../../../components/AccountPageChrome";
import { MaintenanceReminderForm } from "../../../../../../components/MaintenanceReminderForm";
import { maintenanceReminderToWebFormValues } from "../../../../../../lib/cloud/maintenanceReminderFormValues";
import { getWebCloudMaintenanceReminder } from "../../../../../../lib/cloud/maintenanceReminderMutations";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../../../lib/cloud/serverData";
import { updateMaintenanceReminderAction } from "../../../../reminderActions";

type EditMaintenanceReminderPageProps = {
  params: Promise<{
    reminderId: string;
    vehicleId: string;
  }>;
};

export default async function EditMaintenanceReminderPage({
  params,
}: EditMaintenanceReminderPageProps) {
  const { reminderId, vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Reminder pages show cloud account data only. Sign in to edit this cloud maintenance reminder."
          message={authState.errorMessage}
          title="Sign in to edit this reminder"
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

  if (detail.vehicle.archived_at) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <ArchivedVehiclePanel
          reminderId={reminder.id}
          vehicleId={detail.vehicle.id}
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
          <Link
            className="text-sm font-bold text-[var(--primary)]"
            href={`/vehicles/${detail.vehicle.id}/reminders/${reminder.id}`}
          >
            {reminder.title}
          </Link>
          <span className="text-sm text-[var(--muted)]">/</span>
          <span className="text-sm font-semibold text-[var(--muted)]">
            Edit
          </span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Cloud reminder
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Edit Maintenance Reminder
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Changes save to your Supabase account only. Local mobile guest data
            and notification schedules are not changed from the web.
          </p>
        </div>
      </section>

      <MaintenanceReminderForm
        action={updateMaintenanceReminderAction}
        cancelHref={`/vehicles/${detail.vehicle.id}/reminders/${reminder.id}`}
        defaultValues={maintenanceReminderToWebFormValues(reminder)}
        description="Update this cloud maintenance reminder. Status is calculated from this reminder and the cloud vehicle's current odometer."
        reminderId={reminder.id}
        submitLabel="Save Changes"
        vehicle={detail.vehicle}
      />
    </AccountPageShell>
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

function ArchivedVehiclePanel({
  reminderId,
  vehicleId,
}: {
  reminderId: string;
  vehicleId: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Archived vehicle</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Restore this cloud vehicle before editing maintenance reminders.
      </p>
      <Link
        className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
        href={`/vehicles/${vehicleId}/reminders/${reminderId}`}
      >
        Back to reminder
      </Link>
    </section>
  );
}
