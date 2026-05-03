import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../../../components/AccountPageChrome";
import { ServiceRecordForm } from "../../../../../../components/ServiceRecordForm";
import { serviceRecordToWebFormValues } from "../../../../../../lib/cloud/serviceRecordFormValues";
import { getWebCloudServiceRecord } from "../../../../../../lib/cloud/serviceRecordMutations";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../../../lib/cloud/serverData";
import { updateServiceRecordAction } from "../../../../serviceRecordActions";

type EditServiceRecordPageProps = {
  params: Promise<{
    serviceRecordId: string;
    vehicleId: string;
  }>;
};

export default async function EditServiceRecordPage({
  params,
}: EditServiceRecordPageProps) {
  const { serviceRecordId, vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Service record pages show cloud account data only. Sign in to edit this cloud service record."
          message={authState.errorMessage}
          title="Sign in to edit this service record"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let detail: Awaited<ReturnType<typeof loadWebCloudVehicleDetail>> | null =
    null;
  let serviceRecord: Awaited<ReturnType<typeof getWebCloudServiceRecord>> =
    null;
  let loadError: null | string = null;

  try {
    [detail, serviceRecord] = await Promise.all([
      loadWebCloudVehicleDetail({
        userId: authState.user.id,
        vehicleId,
      }),
      getWebCloudServiceRecord({
        serviceRecordId,
        userId: authState.user.id,
        vehicleId,
      }),
    ]);
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Unable to load this cloud service record.";
  }

  if (loadError) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <AccountErrorPanel
          message={loadError}
          title="Service record unavailable"
        />
      </AccountPageShell>
    );
  }

  if (
    !detail ||
    !serviceRecord ||
    serviceRecord.vehicle_id !== detail.vehicle.id
  ) {
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
          serviceRecordId={serviceRecord.id}
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
            href={`/vehicles/${detail.vehicle.id}/service-records/${serviceRecord.id}`}
          >
            {serviceRecord.title}
          </Link>
          <span className="text-sm text-[var(--muted)]">/</span>
          <span className="text-sm font-semibold text-[var(--muted)]">
            Edit
          </span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Cloud service
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Edit Service Record
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Changes save to your Supabase account only. Local mobile guest data
            is not changed from the web.
          </p>
        </div>
      </section>

      <ServiceRecordForm
        action={updateServiceRecordAction}
        cancelHref={`/vehicles/${detail.vehicle.id}/service-records/${serviceRecord.id}`}
        defaultValues={serviceRecordToWebFormValues(serviceRecord)}
        description="Update this cloud service record. The cloud vehicle current odometer will be recalculated from remaining cloud records after saving."
        serviceRecordId={serviceRecord.id}
        submitLabel="Save Changes"
        vehicle={detail.vehicle}
      />
    </AccountPageShell>
  );
}

function NotFoundPanel({ vehicleId }: { vehicleId: string }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Service record not found</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        This cloud service record may have been deleted, or it may belong to
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
  serviceRecordId,
  vehicleId,
}: {
  serviceRecordId: string;
  vehicleId: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Archived vehicle</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Restore this cloud vehicle before editing service records.
      </p>
      <Link
        className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
        href={`/vehicles/${vehicleId}/service-records/${serviceRecordId}`}
      >
        Back to service record
      </Link>
    </section>
  );
}
