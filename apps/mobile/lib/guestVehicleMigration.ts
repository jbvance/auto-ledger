import type { Vehicle } from "@autoledger/shared";

import {
  createVehicleMigrationRun,
  updateMigrationRunStatus,
  upsertVehicleMigrationMapping,
  type MigrationRun,
  type MigrationRunVehicleCounts,
} from "./guestMigration";
import { supabase } from "./supabase";
import { listArchivedVehicles, listVehicles } from "./vehicles";

type CloudVehicleError = {
  code?: string;
  message: string;
};

type CloudVehicleRow = Omit<
  Vehicle,
  "odometer_unit" | "sync_status" | "vehicle_type"
> & {
  odometer_unit: string;
  sync_status: string;
  user_id: string;
  vehicle_type: string;
};

type VehicleMigrationPayload = {
  archived_at: string | null;
  color: string | null;
  created_at: string;
  current_odometer: number;
  initial_odometer: number;
  license_plate: string | null;
  license_state: string | null;
  local_id: string;
  make: string;
  model: string;
  nickname: string;
  notes: string | null;
  odometer_unit: Vehicle["odometer_unit"];
  purchase_date: string | null;
  purchase_odometer: number | null;
  sync_status: "synced";
  trim: string | null;
  updated_at: string;
  user_id: string;
  vehicle_type: Vehicle["vehicle_type"];
  vin: string | null;
  year: number;
};

export type VehicleMigrationItemStatus =
  | "already_migrated"
  | "failed"
  | "migrated";

export type VehicleMigrationItemResult = {
  cloudId: string | null;
  errorMessage: string | null;
  localId: string;
  status: VehicleMigrationItemStatus;
};

export type GuestVehicleMigrationResult = {
  failedCount: number;
  migratedCount: number;
  results: VehicleMigrationItemResult[];
  run: MigrationRun;
  skippedCount: number;
  totalVehicles: number;
};

const vehicleSelect = `
  id,
  user_id,
  local_id,
  nickname,
  make,
  model,
  year,
  trim,
  vin,
  license_plate,
  license_state,
  color,
  vehicle_type,
  initial_odometer,
  current_odometer,
  odometer_unit,
  purchase_date,
  purchase_odometer,
  notes,
  archived_at,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapCloudVehicleRow = (row: CloudVehicleRow): Vehicle => ({
  ...row,
  odometer_unit: row.odometer_unit as Vehicle["odometer_unit"],
  sync_status: row.sync_status as Vehicle["sync_status"],
  vehicle_type: row.vehicle_type as Vehicle["vehicle_type"],
});

const formatCloudVehicleMigrationError = (
  action: string,
  error: CloudVehicleError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase vehicles table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql, then review packages/db/sql/004_verify_local_id_unique_constraints.sql before trying migration.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to vehicles. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated grants and RLS policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const isUniqueConflict = (error: CloudVehicleError) =>
  error.code === "23505" ||
  error.message.toLowerCase().includes("duplicate key");

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the public Supabase URL and anon key before migrating vehicles.",
    );
  }

  return supabase;
};

const toVehicleMigrationPayload = (
  vehicle: Vehicle,
  userId: string,
): VehicleMigrationPayload => ({
  archived_at: optionalText(vehicle.archived_at),
  color: optionalText(vehicle.color),
  created_at: vehicle.created_at,
  current_odometer: vehicle.current_odometer,
  initial_odometer: vehicle.initial_odometer,
  license_plate: optionalText(vehicle.license_plate),
  license_state: optionalText(vehicle.license_state),
  local_id: vehicle.local_id,
  make: vehicle.make,
  model: vehicle.model,
  nickname: vehicle.nickname,
  notes: optionalText(vehicle.notes),
  odometer_unit: vehicle.odometer_unit,
  purchase_date: optionalText(vehicle.purchase_date),
  purchase_odometer: optionalNumber(vehicle.purchase_odometer),
  sync_status: "synced",
  trim: optionalText(vehicle.trim),
  updated_at: vehicle.updated_at,
  user_id: userId,
  vehicle_type: vehicle.vehicle_type,
  vin: optionalText(vehicle.vin),
  year: vehicle.year,
});

const getCloudVehicleByLocalId = async (
  localId: string,
  userId: string,
): Promise<Vehicle | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("vehicles")
    .select(vehicleSelect)
    .eq("user_id", userId)
    .eq("local_id", localId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudVehicleMigrationError("Unable to check migrated vehicle", error),
    );
  }

  return data ? mapCloudVehicleRow(data as CloudVehicleRow) : null;
};

const insertMigratedCloudVehicle = async (
  vehicle: Vehicle,
  userId: string,
): Promise<Vehicle> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("vehicles")
    .insert(toVehicleMigrationPayload(vehicle, userId))
    .select(vehicleSelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudVehicleMigrationError("Unable to migrate vehicle", error),
    );
  }

  return mapCloudVehicleRow(data as CloudVehicleRow);
};

export const migrateGuestVehicleToCloud = async (
  vehicle: Vehicle,
  userId: string,
  runId: string | null = null,
): Promise<VehicleMigrationItemResult> => {
  try {
    const existingCloudVehicle = await getCloudVehicleByLocalId(
      vehicle.local_id,
      userId,
    );

    if (existingCloudVehicle) {
      await upsertVehicleMigrationMapping({
        accountId: userId,
        cloudId: existingCloudVehicle.id,
        localId: vehicle.local_id,
        runId,
        status: "synced",
      });

      return {
        cloudId: existingCloudVehicle.id,
        errorMessage: null,
        localId: vehicle.local_id,
        status: "already_migrated",
      };
    }

    const migratedVehicle = await insertMigratedCloudVehicle(vehicle, userId);

    await upsertVehicleMigrationMapping({
      accountId: userId,
      cloudId: migratedVehicle.id,
      localId: vehicle.local_id,
      runId,
      status: "synced",
    });

    return {
      cloudId: migratedVehicle.id,
      errorMessage: null,
      localId: vehicle.local_id,
      status: "migrated",
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unable to migrate vehicle.";

    if (
      error instanceof Error &&
      isUniqueConflict({ message: error.message })
    ) {
      const existingCloudVehicle = await getCloudVehicleByLocalId(
        vehicle.local_id,
        userId,
      );

      if (existingCloudVehicle) {
        await upsertVehicleMigrationMapping({
          accountId: userId,
          cloudId: existingCloudVehicle.id,
          localId: vehicle.local_id,
          runId,
          status: "synced",
        });

        return {
          cloudId: existingCloudVehicle.id,
          errorMessage: null,
          localId: vehicle.local_id,
          status: "already_migrated",
        };
      }
    }

    await upsertVehicleMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: vehicle.local_id,
      runId,
      status: "failed",
    });

    return {
      cloudId: null,
      errorMessage,
      localId: vehicle.local_id,
      status: "failed",
    };
  }
};

const getVehicleMigrationRunStatus = ({
  failedVehicles,
  totalVehicles,
}: Pick<MigrationRunVehicleCounts, "failedVehicles" | "totalVehicles">) => {
  if (failedVehicles === 0) {
    return "completed";
  }

  if (failedVehicles === totalVehicles) {
    return "failed";
  }

  return "completed_with_errors";
};

export const migrateGuestVehiclesToCloud = async (
  userId: string,
): Promise<GuestVehicleMigrationResult> => {
  const [activeVehicles, archivedVehicles] = await Promise.all([
    listVehicles(),
    listArchivedVehicles(),
  ]);
  const vehicles = [...activeVehicles, ...archivedVehicles];
  const run = await createVehicleMigrationRun({
    accountId: userId,
    totalVehicles: vehicles.length,
  });
  const results: VehicleMigrationItemResult[] = [];
  const counts: MigrationRunVehicleCounts = {
    failedVehicles: 0,
    migratedVehicles: 0,
    skippedVehicles: 0,
    totalVehicles: vehicles.length,
  };

  for (const vehicle of vehicles) {
    const result = await migrateGuestVehicleToCloud(vehicle, userId, run.id);
    results.push(result);

    if (result.status === "migrated") {
      counts.migratedVehicles += 1;
    } else if (result.status === "already_migrated") {
      counts.skippedVehicles += 1;
    } else {
      counts.failedVehicles += 1;
    }

    await updateMigrationRunStatus({
      counts,
      runId: run.id,
      status: "running",
    });
  }

  const completedAt = new Date().toISOString();
  const finalStatus = getVehicleMigrationRunStatus(counts);
  const errorMessage =
    counts.failedVehicles > 0
      ? `${counts.failedVehicles} vehicle migration failed. Local data was not changed.`
      : null;

  await updateMigrationRunStatus({
    completedAt,
    counts,
    errorMessage,
    runId: run.id,
    status: finalStatus,
  });

  return {
    failedCount: counts.failedVehicles,
    migratedCount: counts.migratedVehicles,
    results,
    run: {
      ...run,
      completed_at: completedAt,
      error_message: errorMessage,
      failed_vehicles: counts.failedVehicles,
      migrated_vehicles: counts.migratedVehicles,
      skipped_vehicles: counts.skippedVehicles,
      status: finalStatus,
      updated_at: completedAt,
    },
    skippedCount: counts.skippedVehicles,
    totalVehicles: counts.totalVehicles,
  };
};
