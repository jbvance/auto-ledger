import {
  formatCostAmount,
  formatDisplayDate,
  formatOdometer,
  repairRecordCategoryLabels,
} from "@autoledger/shared";
import { Pencil } from "lucide-react";
import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../../../../components/AccountPageChrome";
import { RecordAttachmentSection } from "../../../../../components/RecordAttachmentList";
import { RepairRecordDeleteForm } from "../../../../../components/RepairRecordForm";
import { listWebCloudAttachmentsForRepairRecord } from "../../../../../lib/cloud/recordAttachmentData";
import { getWebCloudRepairRecord } from "../../../../../lib/cloud/repairRecordMutations";
import {
  getWebCloudAuthState,
  loadWebCloudVehicleDetail,
} from "../../../../../lib/cloud/serverData";
import { deleteRepairRecordAction } from "../../../repairRecordActions";

type RepairRecordDetailPageProps = {
  params: Promise<{
    repairRecordId: string;
    vehicleId: string;
  }>;
};

export default async function RepairRecordDetailPage({
  params,
}: RepairRecordDetailPageProps) {
  const { repairRecordId, vehicleId } = await params;
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Repair record pages show cloud account data only. Sign in to view this cloud repair record."
          message={authState.errorMessage}
          title="Sign in to view this repair record"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let detail: Awaited<ReturnType<typeof loadWebCloudVehicleDetail>> | null =
    null;
  let repairRecord: Awaited<ReturnType<typeof getWebCloudRepairRecord>> = null;
  let attachments: Awaited<
    ReturnType<typeof listWebCloudAttachmentsForRepairRecord>
  > = [];
  let loadError: null | string = null;

  try {
    [detail, repairRecord, attachments] = await Promise.all([
      loadWebCloudVehicleDetail({
        userId: authState.user.id,
        vehicleId,
      }),
      getWebCloudRepairRecord({
        repairRecordId,
        userId: authState.user.id,
        vehicleId,
      }),
      listWebCloudAttachmentsForRepairRecord({
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
            Repair record
          </span>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--primary)]">
              Cloud repair
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight">
              {repairRecord.title}
            </h1>
            <p className="mt-2 text-base leading-7 text-[var(--muted)]">
              {repairRecordCategoryLabels[repairRecord.category]} -{" "}
              {formatDisplayDate(repairRecord.repair_date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canMutate ? (
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
                href={`/vehicles/${detail.vehicle.id}/repair-records/${repairRecord.id}/edit`}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Edit Repair Record
              </Link>
            ) : null}
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-sm font-bold text-[var(--foreground)]"
              href={`/vehicles/${detail.vehicle.id}#repair-records`}
            >
              Back to Vehicle
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-bold">Repair Details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Category">
              {repairRecordCategoryLabels[repairRecord.category]}
            </Detail>
            <Detail label="Repair date">
              {formatDisplayDate(repairRecord.repair_date)}
            </Detail>
            <Detail label="Odometer reading">
              {repairRecord.odometer_reading === null ||
              repairRecord.odometer_reading === undefined
                ? "Not set"
                : formatOdometer(
                    repairRecord.odometer_reading,
                    detail.vehicle.odometer_unit,
                  )}
            </Detail>
            <Detail label="Cost">
              {formatCostAmount(
                repairRecord.cost_amount,
                repairRecord.cost_currency,
              )}
            </Detail>
            <Detail label="Vendor / shop">
              {repairRecord.vendor_name ?? "Not set"}
            </Detail>
            <Detail label="Warranty date">
              {repairRecord.warranty_until_date
                ? formatDisplayDate(repairRecord.warranty_until_date)
                : "Not set"}
            </Detail>
            <Detail label="Warranty odometer">
              {repairRecord.warranty_until_odometer === null ||
              repairRecord.warranty_until_odometer === undefined
                ? "Not set"
                : formatOdometer(
                    repairRecord.warranty_until_odometer,
                    detail.vehicle.odometer_unit,
                  )}
            </Detail>
            <Detail label="Created">
              {new Date(repairRecord.created_at).toLocaleString("en-US")}
            </Detail>
            <Detail label="Updated">
              {new Date(repairRecord.updated_at).toLocaleString("en-US")}
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
              <RepairRecordDeleteForm
                action={deleteRepairRecordAction}
                repairRecordId={repairRecord.id}
                vehicleId={detail.vehicle.id}
              />
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-[var(--background)] p-3 text-sm leading-6 text-[var(--muted)]">
              Restore this cloud vehicle before editing or deleting repair
              records.
            </p>
          )}
        </section>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TextPanel label="Description" value={repairRecord.description} />
        <TextPanel label="Notes" value={repairRecord.notes} />
      </section>

      <RecordAttachmentSection
        attachments={attachments}
        description="Private cloud receipts and documents attached to this repair record."
        getAttachmentHref={(attachment) =>
          `/vehicles/${detail.vehicle.id}/repair-records/${repairRecord.id}/attachments/${attachment.id}/open`
        }
      />
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
