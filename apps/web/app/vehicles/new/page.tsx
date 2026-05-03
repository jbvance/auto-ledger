import Link from "next/link";

import {
  AccountAuthPrompt,
  AccountPageShell,
} from "../../../components/AccountPageChrome";
import {
  VehicleForm,
} from "../../../components/VehicleForm";
import { emptyWebVehicleFormValues } from "../../../lib/cloud/vehicleFormValues";
import { getWebCloudAuthState } from "../../../lib/cloud/serverData";
import { createVehicleAction } from "../actions";

export default async function NewVehiclePage() {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    return (
      <AccountPageShell>
        <AccountAuthPrompt
          defaultMessage="Vehicle pages show cloud account data only. Sign in to add a cloud vehicle."
          message={authState.errorMessage}
          title="Sign in to add a vehicle"
        />
      </AccountPageShell>
    );
  }

  return (
    <AccountPageShell userEmail={authState.user.email ?? null}>
      <section className="flex flex-col gap-3 border-b border-[var(--line)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="text-sm font-bold text-[var(--primary)]"
            href="/vehicles"
          >
            Vehicles
          </Link>
          <span className="text-sm text-[var(--muted)]">/</span>
          <span className="text-sm font-semibold text-[var(--muted)]">
            Add vehicle
          </span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[var(--primary)]">
            Cloud vehicle
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            Add Vehicle
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
            This saves a vehicle to your Supabase account. Local mobile guest
            records remain separate.
          </p>
        </div>
      </section>

      <VehicleForm
        action={createVehicleAction}
        cancelHref="/vehicles"
        defaultValues={emptyWebVehicleFormValues}
        description="Required fields match the mobile app: nickname, make, model, year, vehicle type, current odometer, and odometer unit."
        submitLabel="Add Vehicle"
      />
    </AccountPageShell>
  );
}
