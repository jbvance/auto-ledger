import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../../components/AccountPageChrome";
import { RepairRecordForm } from "../../../../../components/RepairRecordForm";
import { emptyWebRepairRecordFormValues } from "../../../../../lib/cloud/repairRecordFormValues";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../../lib/cloud/serverData";
import { createRepairRecordAction } from "../../../repairRecordActions";

type NewRepairRecordPageProps = {
  params: Promise<{
    vehicleId: string;
  }>;
};

export default async function NewRepairRecordPage({
  params,
}: NewRepairRecordPageProps) {
  const { vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Repair record pages show cloud account data only. Sign in to add a cloud repair record."
          message={authState.errorMessage}
          title="Sign in to add a repair record"
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
        <NotFoundPanel />
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
            Add repair record
          </span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Cloud repair
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Add Repair Record
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
            This saves non-routine repairs to your Supabase account only. Local
            mobile guest records remain separate.
          </p>
        </div>
      </section>

      <RepairRecordForm
        action={createRepairRecordAction}
        cancelHref={`/vehicles/${detail.vehicle.id}#repair-records`}
        defaultValues={emptyWebRepairRecordFormValues(detail.vehicle)}
        description="Log a repair for this account-saved vehicle. Higher repair odometer readings update the cloud vehicle's current odometer."
        submitLabel="Save Repair Record"
        vehicle={detail.vehicle}
      />
    </AccountPageShell>
  );
}

function NotFoundPanel() {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Vehicle not found</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        This cloud vehicle may have been deleted, archived, or belong to another
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

function ArchivedVehiclePanel({ vehicleId }: { vehicleId: string }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Archived vehicle</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Restore this cloud vehicle before adding repair records.
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
