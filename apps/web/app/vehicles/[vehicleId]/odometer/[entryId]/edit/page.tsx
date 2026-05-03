import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../../../components/AccountPageChrome";
import {
  OdometerEntryDeleteForm,
  OdometerEntryForm,
} from "../../../../../../components/OdometerEntryForm";
import { odometerEntryToWebFormValues } from "../../../../../../lib/cloud/odometerFormValues";
import { getWebCloudOdometerEntry } from "../../../../../../lib/cloud/odometerMutations";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../../../lib/cloud/serverData";
import {
  deleteOdometerEntryAction,
  updateOdometerEntryAction,
} from "../../../../odometerActions";

type EditOdometerEntryPageProps = {
  params: Promise<{
    entryId: string;
    vehicleId: string;
  }>;
};

export default async function EditOdometerEntryPage({
  params,
}: EditOdometerEntryPageProps) {
  const { entryId, vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Odometer pages show cloud account data only. Sign in to edit this cloud odometer entry."
          message={authState.errorMessage}
          title="Sign in to edit an odometer entry"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let detail: Awaited<ReturnType<typeof loadWebCloudVehicleDetail>> | null =
    null;
  let entry: Awaited<ReturnType<typeof getWebCloudOdometerEntry>> | null = null;
  let loadError: null | string = null;

  try {
    [detail, entry] = await Promise.all([
      loadWebCloudVehicleDetail({
        userId: authState.user.id,
        vehicleId,
      }),
      getWebCloudOdometerEntry({
        entryId,
        userId: authState.user.id,
        vehicleId,
      }),
    ]);
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Unable to load this cloud odometer entry.";
  }

  if (loadError) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <AccountErrorPanel
          message={loadError}
          title="Odometer entry unavailable"
        />
      </AccountPageShell>
    );
  }

  if (!detail || !entry || entry.vehicle_id !== detail.vehicle.id) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <NotFoundPanel vehicleId={vehicleId} />
      </AccountPageShell>
    );
  }

  if (detail.vehicle.archived_at) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <ArchivedVehiclePanel vehicleId={detail.vehicle.id} />
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
          <span className="text-sm font-semibold text-[var(--muted)]">
            Edit odometer
          </span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Cloud odometer
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Edit Odometer Entry
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Update this cloud reading. The cloud vehicle current odometer will
            be recalculated from remaining cloud records after saving.
          </p>
        </div>
      </section>

      <OdometerEntryForm
        action={updateOdometerEntryAction}
        cancelHref={`/vehicles/${detail.vehicle.id}#odometer-entries`}
        defaultValues={odometerEntryToWebFormValues(entry)}
        description="Changes save to your Supabase account only. Local mobile guest data is not changed from the web."
        entryId={entry.id}
        submitLabel="Save Changes"
        vehicle={detail.vehicle}
      />

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-bold">Danger Zone</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Delete only this odometer entry. The parent cloud vehicle and other
          records stay in your account.
        </p>
        <div className="mt-4">
          <OdometerEntryDeleteForm
            action={deleteOdometerEntryAction}
            entryId={entry.id}
            vehicleId={detail.vehicle.id}
          />
        </div>
      </section>
    </AccountPageShell>
  );
}

function NotFoundPanel({ vehicleId }: { vehicleId: string }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Odometer entry not found</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        This cloud odometer entry may have been deleted, or it may belong to
        another account.
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

function ArchivedVehiclePanel({ vehicleId }: { vehicleId: string }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Archived vehicle</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Restore this cloud vehicle before editing odometer entries.
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
