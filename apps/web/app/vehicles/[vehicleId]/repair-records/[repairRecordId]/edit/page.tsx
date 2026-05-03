import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../../../components/AccountPageChrome";
import { RepairRecordForm } from "../../../../../../components/RepairRecordForm";
import { repairRecordToWebFormValues } from "../../../../../../lib/cloud/repairRecordFormValues";
import { getWebCloudRepairRecord } from "../../../../../../lib/cloud/repairRecordMutations";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../../../lib/cloud/serverData";
import { updateRepairRecordAction } from "../../../../repairRecordActions";

type EditRepairRecordPageProps = {
  params: Promise<{
    repairRecordId: string;
    vehicleId: string;
  }>;
};

export default async function EditRepairRecordPage({
  params,
}: EditRepairRecordPageProps) {
  const { repairRecordId, vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Repair record pages show cloud account data only. Sign in to edit this cloud repair record."
          message={authState.errorMessage}
          title="Sign in to edit this repair record"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let detail: Awaited<ReturnType<typeof loadWebCloudVehicleDetail>> | null =
    null;
  let repairRecord: Awaited<ReturnType<typeof getWebCloudRepairRecord>> = null;
  let loadError: null | string = null;

  try {
    [detail, repairRecord] = await Promise.all([
      loadWebCloudVehicleDetail({
        userId: authState.user.id,
        vehicleId,
      }),
      getWebCloudRepairRecord({
        repairRecordId,
        userId: authState.user.id,
        vehicleId,
      }),
    ]);
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Unable to load this cloud repair record.";
  }

  if (loadError) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <AccountErrorPanel
          message={loadError}
          title="Repair record unavailable"
        />
      </AccountPageShell>
    );
  }

  if (!detail || !repairRecord || repairRecord.vehicle_id !== detail.vehicle.id) {
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
          repairRecordId={repairRecord.id}
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
            href={`/vehicles/${detail.vehicle.id}/repair-records/${repairRecord.id}`}
          >
            {repairRecord.title}
          </Link>
          <span className="text-sm text-[var(--muted)]">/</span>
          <span className="text-sm font-semibold text-[var(--muted)]">
            Edit
          </span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Cloud repair
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Edit Repair Record
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Changes save to your Supabase account only. Local mobile guest data
            is not changed from the web.
          </p>
        </div>
      </section>

      <RepairRecordForm
        action={updateRepairRecordAction}
        cancelHref={`/vehicles/${detail.vehicle.id}/repair-records/${repairRecord.id}`}
        defaultValues={repairRecordToWebFormValues(repairRecord)}
        description="Update this cloud repair record. The cloud vehicle current odometer will be recalculated from remaining cloud records after saving."
        repairRecordId={repairRecord.id}
        submitLabel="Save Changes"
        vehicle={detail.vehicle}
      />
    </AccountPageShell>
  );
}

function NotFoundPanel({ vehicleId }: { vehicleId: string }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Repair record not found</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        This cloud repair record may have been deleted, or it may belong to
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

function ArchivedVehiclePanel({
  repairRecordId,
  vehicleId,
}: {
  repairRecordId: string;
  vehicleId: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Archived vehicle</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Restore this cloud vehicle before editing repair records.
      </p>
      <Link
        className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
        href={`/vehicles/${vehicleId}/repair-records/${repairRecordId}`}
      >
        Back to repair record
      </Link>
    </section>
  );
}
