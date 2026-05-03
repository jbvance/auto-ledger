import {
  formatOdometer,
  formatVehicleSubtitle,
  formatVehicleTitle,
  vehicleTypeLabels,
  type Vehicle,
} from "@autoledger/shared";
import Link from "next/link";

import { SignOutButton } from "../../components/SignOutButton";
import {
  getWebCloudAuthState,
  listWebCloudVehicles,
} from "../../lib/cloud/serverData";

export default async function VehiclesPage() {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <PageShell>
        <AuthPrompt message={authState.errorMessage} />
      </PageShell>
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
      <PageShell userEmail={userEmail}>
        <ErrorPanel message={loadError ?? "Unable to load cloud vehicles."} />
      </PageShell>
    );
  }

  return (
    <PageShell userEmail={userEmail}>
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
    </PageShell>
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

function AuthPrompt({ message }: { message: string | null }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
      <h1 className="text-3xl font-bold">Sign in to view vehicles</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {message ??
          "Vehicle pages show cloud account data only. Sign in to continue."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          className="rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
          href="/login"
        >
          Sign in
        </Link>
        <Link
          className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm font-bold text-[var(--foreground)]"
          href="/signup"
        >
          Create account
        </Link>
      </div>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-[var(--surface)] p-6">
      <h1 className="text-2xl font-bold">Vehicles unavailable</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{message}</p>
    </section>
  );
}

function PageShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: null | string;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link className="text-xl font-bold" href="/">
            AutoLedger
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--foreground)]"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--foreground)]"
              href="/vehicles"
            >
              Vehicles
            </Link>
            {userEmail ? (
              <>
                <span className="hidden text-sm font-semibold text-[var(--muted)] md:inline">
                  {userEmail}
                </span>
                <SignOutButton />
              </>
            ) : null}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
