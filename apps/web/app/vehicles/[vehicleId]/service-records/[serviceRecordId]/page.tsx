import {
  formatCostAmount,
  formatDisplayDate,
  formatOdometer,
  serviceRecordCategoryLabels,
} from "@autoledger/shared";
import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../../components/AccountPageChrome";
import { ServiceRecordDeleteForm } from "../../../../../components/ServiceRecordForm";
import { getWebCloudServiceRecord } from "../../../../../lib/cloud/serviceRecordMutations";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../../lib/cloud/serverData";
import { deleteServiceRecordAction } from "../../../serviceRecordActions";

type ServiceRecordDetailPageProps = {
  params: Promise<{
    serviceRecordId: string;
    vehicleId: string;
  }>;
};

export default async function ServiceRecordDetailPage({
  params,
}: ServiceRecordDetailPageProps) {
  const { serviceRecordId, vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Service record pages show cloud account data only. Sign in to view this cloud service record."
          message={authState.errorMessage}
          title="Sign in to view this service record"
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

  const canMutate = !detail.vehicle.archived_at;

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
            Service record
          </span>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--primary)]">
              Cloud service
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight">
              {serviceRecord.title}
            </h1>
            <p className="mt-2 text-base leading-7 text-[var(--muted)]">
              {serviceRecordCategoryLabels[serviceRecord.category]} -{" "}
              {formatDisplayDate(serviceRecord.service_date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canMutate ? (
              <Link
                className="rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
                href={`/vehicles/${detail.vehicle.id}/service-records/${serviceRecord.id}/edit`}
              >
                Edit Service Record
              </Link>
            ) : null}
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-sm font-bold text-[var(--foreground)]"
              href={`/vehicles/${detail.vehicle.id}#service-records`}
            >
              Back to Vehicle
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-bold">Service Details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Category">
              {serviceRecordCategoryLabels[serviceRecord.category]}
            </Detail>
            <Detail label="Service date">
              {formatDisplayDate(serviceRecord.service_date)}
            </Detail>
            <Detail label="Odometer reading">
              {serviceRecord.odometer_reading === null ||
              serviceRecord.odometer_reading === undefined
                ? "Not set"
                : formatOdometer(
                    serviceRecord.odometer_reading,
                    detail.vehicle.odometer_unit,
                  )}
            </Detail>
            <Detail label="Cost">
              {formatCostAmount(
                serviceRecord.cost_amount,
                serviceRecord.cost_currency,
              )}
            </Detail>
            <Detail label="Vendor / shop">
              {serviceRecord.vendor_name ?? "Not set"}
            </Detail>
            <Detail label="Created">
              {new Date(serviceRecord.created_at).toLocaleString("en-US")}
            </Detail>
            <Detail label="Updated">
              {new Date(serviceRecord.updated_at).toLocaleString("en-US")}
            </Detail>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-bold">Actions</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Changes save to your Supabase account only. Local mobile guest data
            is not changed from the web.
          </p>
          {canMutate ? (
            <div className="mt-4">
              <ServiceRecordDeleteForm
                action={deleteServiceRecordAction}
                serviceRecordId={serviceRecord.id}
                vehicleId={detail.vehicle.id}
              />
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-[var(--background)] p-3 text-sm leading-6 text-[var(--muted)]">
              Restore this cloud vehicle before editing or deleting service
              records.
            </p>
          )}
        </section>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TextPanel label="Description" value={serviceRecord.description} />
        <TextPanel label="Notes" value={serviceRecord.notes} />
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

function TextPanel({ label, value }: { label: string; value?: null | string }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">{label}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {value ?? "Not set"}
      </p>
    </section>
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
