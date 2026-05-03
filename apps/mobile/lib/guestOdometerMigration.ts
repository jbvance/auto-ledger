import type { OdometerEntry } from "@autoledger/shared";

import { recalculateCloudVehicleOdometer } from "./cloudVehicleOdometer";
import {
  createOdometerMigrationRun,
  getOdometerMigrationMappings,
  getVehicleMigrationMappings,
  updateOdometerMigrationRunStatus,
  upsertOdometerMigrationMapping,
  type MigrationEntityMapping,
  type MigrationRun,
  type MigrationRunOdometerCounts,
} from "./guestMigration";
import { listAllOdometerEntries } from "./odometerEntries";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

type CloudOdometerMigrationError = {
  code?: string;
  message: string;
};

type CloudOdometerEntryRow = Omit<
  OdometerEntry,
  "odometer_unit" | "source_type" | "sync_status"
> & {
  odometer_unit: string;
  source_type: string;
  sync_status: string;
  user_id: string;
};

type CloudVehicleForMigration = {
  id: string;
  odometer_unit: string;
};

type OdometerMigrationPayload = {
  created_at: string;
  local_id: string;
  notes: string | null;
  odometer_unit: OdometerEntry["odometer_unit"];
  reading: number;
  reading_date: string;
  source_type: OdometerEntry["source_type"];
  sync_status: "synced";
  updated_at: string;
  user_id: string;
  vehicle_id: string;
};

export type OdometerMigrationItemStatus =
  | "already_migrated"
  | "failed"
  | "migrated"
  | "skipped_missing_vehicle_mapping";

export type OdometerMigrationItemResult = {
  cloudId: string | null;
  cloudVehicleId: string | null;
  errorMessage: string | null;
  localId: string;
  localVehicleId: string;
  status: OdometerMigrationItemStatus;
};

export type GuestOdometerMigrationResult = {
  failedCount: number;
  migratedCount: number;
  recalculatedVehicleCount: number;
  results: OdometerMigrationItemResult[];
  run: MigrationRun;
  skippedCount: number;
  skippedMissingVehicleMappingCount: number;
  totalOdometerEntries: number;
};

const odometerEntrySelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  reading,
  reading_date,
  odometer_unit,
  source_type,
  notes,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const mapCloudOdometerEntryRow = (
  row: CloudOdometerEntryRow,
): OdometerEntry => ({
  ...row,
  odometer_unit: row.odometer_unit as OdometerEntry["odometer_unit"],
  source_type: row.source_type as OdometerEntry["source_type"],
  sync_status: row.sync_status as OdometerEntry["sync_status"],
});

const formatCloudOdometerMigrationError = (
  action: string,
  error: CloudOdometerMigrationError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase odometer_entries table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql, then review packages/db/sql/004_verify_local_id_unique_constraints.sql before trying odometer migration.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to odometer entries. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated grants and RLS policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const isUniqueConflict = (error: CloudOdometerMigrationError) =>
  error.code === "23505" ||
  error.message.toLowerCase().includes("duplicate key");

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the public Supabase URL and anon key before migrating odometer entries.",
    );
  }

  return supabase;
};

const assertAuthenticatedUser = async (userId: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Sign in before migrating odometer entries.");
  }

  if (data.user.id !== userId) {
    throw new Error("Signed-in account does not match the migration account.");
  }
};

const toOdometerMigrationPayload = ({
  cloudVehicleId,
  entry,
  userId,
}: {
  cloudVehicleId: string;
  entry: OdometerEntry;
  userId: string;
}): OdometerMigrationPayload => ({
  created_at: entry.created_at,
  local_id: entry.local_id,
  notes: optionalText(entry.notes),
  odometer_unit: entry.odometer_unit,
  reading: entry.reading,
  reading_date: entry.reading_date,
  source_type: entry.source_type,
  sync_status: "synced",
  updated_at: entry.updated_at,
  user_id: userId,
  vehicle_id: cloudVehicleId,
});

const getCloudOdometerEntryByLocalId = async (
  localId: string,
  userId: string,
): Promise<OdometerEntry | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("odometer_entries")
    .select(odometerEntrySelect)
    .eq("user_id", userId)
    .eq("local_id", localId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudOdometerMigrationError(
        "Unable to check migrated odometer entry",
        error,
      ),
    );
  }

  return data ? mapCloudOdometerEntryRow(data as CloudOdometerEntryRow) : null;
};

const getCloudVehicleForMigration = async (
  cloudVehicleId: string,
  userId: string,
): Promise<CloudVehicleForMigration | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("vehicles")
    .select("id, odometer_unit")
    .eq("id", cloudVehicleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudOdometerMigrationError(
        "Unable to load mapped cloud vehicle",
        error,
      ),
    );
  }

  return data as CloudVehicleForMigration | null;
};

const insertMigratedCloudOdometerEntry = async ({
  cloudVehicleId,
  entry,
  userId,
}: {
  cloudVehicleId: string;
  entry: OdometerEntry;
  userId: string;
}): Promise<OdometerEntry> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("odometer_entries")
    .insert(toOdometerMigrationPayload({ cloudVehicleId, entry, userId }))
    .select(odometerEntrySelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudOdometerMigrationError(
        "Unable to migrate odometer entry",
        error,
      ),
    );
  }

  return mapCloudOdometerEntryRow(data as CloudOdometerEntryRow);
};

const getVehicleMappingForEntry = async ({
  entry,
  vehicleMappingsByLocalId,
}: {
  entry: OdometerEntry;
  vehicleMappingsByLocalId: Map<string, MigrationEntityMapping>;
}) => {
  const localVehicle = await getVehicle(entry.vehicle_id, {
    includeArchived: true,
  });
  const localVehicleLocalId = localVehicle?.local_id ?? entry.vehicle_id;
  const mapping = vehicleMappingsByLocalId.get(localVehicleLocalId);

  return {
    localVehicleId: entry.vehicle_id,
    localVehicleLocalId,
    mapping:
      mapping?.status === "synced" && mapping.cloud_id ? mapping : null,
  };
};

export const migrateGuestOdometerEntryToCloud = async (
  entry: OdometerEntry,
  userId: string,
  vehicleMapping: MigrationEntityMapping | null,
  runId: string | null = null,
): Promise<OdometerMigrationItemResult> => {
  if (!vehicleMapping?.cloud_id) {
    const errorMessage =
      "Skipped because this odometer entry's vehicle has not been migrated to this account yet.";

    await upsertOdometerMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: entry.local_id,
      runId,
      status: "skipped",
    });

    return {
      cloudId: null,
      cloudVehicleId: null,
      errorMessage,
      localId: entry.local_id,
      localVehicleId: entry.vehicle_id,
      status: "skipped_missing_vehicle_mapping",
    };
  }

  try {
    const cloudVehicle = await getCloudVehicleForMigration(
      vehicleMapping.cloud_id,
      userId,
    );

    if (!cloudVehicle) {
      throw new Error(
        "Mapped cloud vehicle was not found. Rerun vehicle migration before odometer migration.",
      );
    }

    if (entry.odometer_unit !== cloudVehicle.odometer_unit) {
      throw new Error("Odometer unit must match the mapped cloud vehicle.");
    }

    const existingCloudEntry = await getCloudOdometerEntryByLocalId(
      entry.local_id,
      userId,
    );

    if (existingCloudEntry) {
      await upsertOdometerMigrationMapping({
        accountId: userId,
        cloudId: existingCloudEntry.id,
        localId: entry.local_id,
        runId,
        status: "synced",
      });

      return {
        cloudId: existingCloudEntry.id,
        cloudVehicleId: existingCloudEntry.vehicle_id,
        errorMessage: null,
        localId: entry.local_id,
        localVehicleId: entry.vehicle_id,
        status: "already_migrated",
      };
    }

    const migratedEntry = await insertMigratedCloudOdometerEntry({
      cloudVehicleId: cloudVehicle.id,
      entry,
      userId,
    });

    await upsertOdometerMigrationMapping({
      accountId: userId,
      cloudId: migratedEntry.id,
      localId: entry.local_id,
      runId,
      status: "synced",
    });

    return {
      cloudId: migratedEntry.id,
      cloudVehicleId: migratedEntry.vehicle_id,
      errorMessage: null,
      localId: entry.local_id,
      localVehicleId: entry.vehicle_id,
      status: "migrated",
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to migrate odometer entry.";

    if (
      error instanceof Error &&
      isUniqueConflict({ message: error.message })
    ) {
      const existingCloudEntry = await getCloudOdometerEntryByLocalId(
        entry.local_id,
        userId,
      );

      if (existingCloudEntry) {
        await upsertOdometerMigrationMapping({
          accountId: userId,
          cloudId: existingCloudEntry.id,
          localId: entry.local_id,
          runId,
          status: "synced",
        });

        return {
          cloudId: existingCloudEntry.id,
          cloudVehicleId: existingCloudEntry.vehicle_id,
          errorMessage: null,
          localId: entry.local_id,
          localVehicleId: entry.vehicle_id,
          status: "already_migrated",
        };
      }
    }

    await upsertOdometerMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: entry.local_id,
      runId,
      status: "failed",
    });

    return {
      cloudId: null,
      cloudVehicleId: vehicleMapping.cloud_id,
      errorMessage,
      localId: entry.local_id,
      localVehicleId: entry.vehicle_id,
      status: "failed",
    };
  }
};

const getOdometerMigrationRunStatus = ({
  failedOdometerEntries,
  skippedOdometerEntriesMissingVehicleMapping,
  totalOdometerEntries,
}: Pick<
  MigrationRunOdometerCounts,
  | "failedOdometerEntries"
  | "skippedOdometerEntriesMissingVehicleMapping"
  | "totalOdometerEntries"
>) => {
  if (
    failedOdometerEntries === 0 &&
    skippedOdometerEntriesMissingVehicleMapping === 0
  ) {
    return "completed";
  }

  if (
    failedOdometerEntries + skippedOdometerEntriesMissingVehicleMapping ===
    totalOdometerEntries
  ) {
    return "failed";
  }

  return "completed_with_errors";
};

export const migrateGuestOdometerEntriesToCloud = async (
  userId: string,
): Promise<GuestOdometerMigrationResult> => {
  await assertAuthenticatedUser(userId);

  const [entries, vehicleMappings] = await Promise.all([
    listAllOdometerEntries(),
    getVehicleMigrationMappings(userId),
  ]);
  const run = await createOdometerMigrationRun({
    accountId: userId,
    totalOdometerEntries: entries.length,
  });
  const vehicleMappingsByLocalId = new Map(
    vehicleMappings.map((mapping) => [mapping.local_id, mapping]),
  );
  const counts: MigrationRunOdometerCounts = {
    failedOdometerEntries: 0,
    migratedOdometerEntries: 0,
    skippedOdometerEntries: 0,
    skippedOdometerEntriesMissingVehicleMapping: 0,
    totalOdometerEntries: entries.length,
  };
  const results: OdometerMigrationItemResult[] = [];
  const affectedCloudVehicleIds = new Set<string>();

  for (const entry of entries) {
    const { mapping } = await getVehicleMappingForEntry({
      entry,
      vehicleMappingsByLocalId,
    });
    const result = await migrateGuestOdometerEntryToCloud(
      entry,
      userId,
      mapping,
      run.id,
    );

    results.push(result);

    if (result.status === "migrated") {
      counts.migratedOdometerEntries += 1;
    } else if (result.status === "already_migrated") {
      counts.skippedOdometerEntries += 1;
    } else if (result.status === "skipped_missing_vehicle_mapping") {
      counts.skippedOdometerEntriesMissingVehicleMapping += 1;
    } else {
      counts.failedOdometerEntries += 1;
    }

    if (result.cloudVehicleId) {
      affectedCloudVehicleIds.add(result.cloudVehicleId);
    }

    await updateOdometerMigrationRunStatus({
      counts,
      runId: run.id,
      status: "running",
    });
  }

  for (const cloudVehicleId of affectedCloudVehicleIds) {
    try {
      await recalculateCloudVehicleOdometer(cloudVehicleId, userId, {
        includeArchived: true,
        preserveCurrent: true,
      });
    } catch (error: unknown) {
      counts.failedOdometerEntries += 1;
      results.push({
        cloudId: null,
        cloudVehicleId,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unable to recalculate cloud vehicle odometer.",
        localId: `cloud_vehicle_recalculation_${cloudVehicleId}`,
        localVehicleId: "",
        status: "failed",
      });
    }
  }

  const completedAt = new Date().toISOString();
  const finalStatus = getOdometerMigrationRunStatus(counts);
  const errorParts = [
    counts.failedOdometerEntries > 0
      ? `${counts.failedOdometerEntries} odometer migration issue${counts.failedOdometerEntries === 1 ? "" : "s"} occurred`
      : null,
    counts.skippedOdometerEntriesMissingVehicleMapping > 0
      ? `${counts.skippedOdometerEntriesMissingVehicleMapping} odometer entr${counts.skippedOdometerEntriesMissingVehicleMapping === 1 ? "y was" : "ies were"} skipped because vehicle migration mapping was missing`
      : null,
  ].filter(Boolean);
  const errorMessage =
    errorParts.length > 0
      ? `${errorParts.join("; ")}. Local data was not changed.`
      : null;

  await updateOdometerMigrationRunStatus({
    completedAt,
    counts,
    errorMessage,
    runId: run.id,
    status: finalStatus,
  });

  return {
    failedCount: counts.failedOdometerEntries,
    migratedCount: counts.migratedOdometerEntries,
    recalculatedVehicleCount: affectedCloudVehicleIds.size,
    results,
    run: {
      ...run,
      completed_at: completedAt,
      error_message: errorMessage,
      failed_odometer_entries: counts.failedOdometerEntries,
      migrated_odometer_entries: counts.migratedOdometerEntries,
      skipped_odometer_entries: counts.skippedOdometerEntries,
      skipped_odometer_entries_missing_vehicle_mapping:
        counts.skippedOdometerEntriesMissingVehicleMapping,
      status: finalStatus,
      total_odometer_entries: counts.totalOdometerEntries,
      updated_at: completedAt,
    },
    skippedCount: counts.skippedOdometerEntries,
    skippedMissingVehicleMappingCount:
      counts.skippedOdometerEntriesMissingVehicleMapping,
    totalOdometerEntries: counts.totalOdometerEntries,
  };
};

export { getOdometerMigrationMappings };
