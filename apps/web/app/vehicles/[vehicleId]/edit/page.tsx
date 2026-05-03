import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../components/AccountPageChrome";
import {
  VehicleForm,
} from "../../../../components/VehicleForm";
import { vehicleToWebVehicleFormValues } from "../../../../lib/cloud/vehicleFormValues";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../lib/cloud/serverData";
import { updateVehicleAction } from "../../actions";

type EditVehiclePageProps = {
  params: Promise<{
    vehicleId: string;
  }>;
};

export default async function EditVehiclePage({ params }: EditVehiclePageProps) {
  const { vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Vehicle pages show cloud account data only. Sign in to edit this cloud vehicle."
          message={authState.errorMessage}
          title="Sign in to edit this vehicle"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let detail: Awaited<ReturnType<typeof loadWebCloudVehicleDetail>> | null =
    null;
  let loadError: null | string = null;

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
        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
          <h1 className="text-3xl font-bold">Vehicle not found</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            This cloud vehicle may have been deleted, or it may belong to
            another account.
          </p>
          <Link
            className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
            href="/vehicles"
          >
            Back to vehicles
          </Link>
        </section>
      </AccountPageShell>
    );
  }

  if (detail.vehicle.archived_at) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
          <h1 className="text-3xl font-bold">Archived vehicle</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Restore this cloud vehicle before editing it. Archived vehicles keep
            their records, but they cannot be edited in this web slice.
          </p>
          <Link
            className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
            href={`/vehicles/${detail.vehicle.id}`}
          >
            Back to vehicle
          </Link>
        </section>
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
            Edit
          </span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Cloud vehicle
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Edit Vehicle
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Changes save to your Supabase account only. Local mobile guest data
            is not changed from the web.
          </p>
        </div>
      </section>

      <VehicleForm
        action={updateVehicleAction}
        cancelHref={`/vehicles/${detail.vehicle.id}`}
        defaultValues={vehicleToWebVehicleFormValues(detail.vehicle)}
        description="Update the cloud vehicle profile. Existing odometer, service, repair, reminder, and attachment records are preserved."
        submitLabel="Save Changes"
        vehicleId={detail.vehicle.id}
      />
    </AccountPageShell>
  );
}
