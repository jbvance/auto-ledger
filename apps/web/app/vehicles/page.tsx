import {
  formatOdometer,
  formatVehicleSubtitle,
  formatVehicleTitle,
  vehicleTypeLabels,
  type Vehicle,
} from "@autoledger/shared";
import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountErrorPanel,
  AccountPageShell,
} from "../../components/AccountPageChrome";
import {
  getWebCloudAuthState,
  listWebCloudVehicles,
} from "../../lib/cloud/serverData";

export default async function VehiclesPage() {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Vehicle pages show cloud account data only. Sign in to continue."
          message={authState.errorMessage}
          title="Sign in to view vehicles"
        />
      </AccountPageShell>
    );
  }

  const userEmail = authState.user.email ?? null;
  let vehicles: Vehicle[] | null = null;
  let loadError: string | null = null;

  try {
    vehicles = await listWebCloudVehicles({
      includeArchived: true,
      userId: authState.user.id,
    });
  } catch (error: unknown) {
    loadError =
      error instanceof Error ? error.message : "Unable to load cloud vehicles.";
  }

  if (loadError || !vehicles) {
    return (
      <AccountPageShell userEmail={userEmail}>
        <AccountErrorPanel
          message={loadError ?? "Unable to load cloud vehicles."}
          title="Vehicles unavailable"
        />
      </AccountPageShell>
    );
  }

  return (
    <AccountPageShell userEmail={userEmail}>
      <section className="flex flex-col gap-3 border-b border-[var(--line)] pb-5">
        <p className="text-sm font-bold uppercase text-[var(--primary)]">
          Cloud vehicles
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold leading-tight">Vehicles</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Account-saved vehicles only. Web views do not read local mobile
              guest records.
            </p>
          </div>
          <Link
            className="rounded-lg bg-[var(--primary)] px-4 py-3 text-center text-sm font-bold text-white"
            href="/dashboard"
          >
            Dashboard
          </Link>
        </div>
      </section>

      {vehicles.length === 0 ? (
        <EmptyVehicles />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </section>
      )}
    </AccountPageShell>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const isArchived = Boolean(vehicle.archived_at);

  return (
    <Link
      className="flex flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--foreground)] transition hover:border-[var(--primary)]"
      href={`/vehicles/${vehicle.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{formatVehicleTitle(vehicle)}</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
            {formatVehicleSubtitle(vehicle)}
          </p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-xs font-bold uppercase ${
            isArchived
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {isArchived ? "Archived" : "Active"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <VehicleBadge>{vehicleTypeLabels[vehicle.vehicle_type]}</VehicleBadge>
        <VehicleBadge>
          {formatOdometer(vehicle.current_odometer, vehicle.odometer_unit)}
        </VehicleBadge>
      </div>
    </Link>
  );
}

function VehicleBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--background)] px-3 py-2 text-xs font-bold uppercase text-[var(--muted)]">
      {children}
    </span>
  );
}

function EmptyVehicles() {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="text-xl font-bold">No vehicles in your account yet.</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Add cloud vehicles from the mobile app for now. Web create and edit
        flows are intentionally deferred in this slice.
      </p>
    </section>
  );
}
