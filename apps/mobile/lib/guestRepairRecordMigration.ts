import type { RepairRecord } from "@autoledger/shared";

import {
  getCloudVehicleForOdometer,
  recalculateCloudVehicleOdometer,
} from "./cloudVehicleOdometer";
import {
  createRepairRecordMigrationRun,
  getRepairRecordMigrationMappings,
  getVehicleMigrationMappings,
  updateRepairRecordMigrationRunStatus,
  upsertRepairRecordMigrationMapping,
  type MigrationEntityMapping,
  type MigrationRun,
  type MigrationRunRepairRecordCounts,
} from "./guestMigration";
import { listAllRepairRecords } from "./repairRecords";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

type CloudRepairRecordMigrationError = {
  code?: string;
  message: string;
};

type CloudRepairRecordRow = Omit<RepairRecord, "category" | "sync_status"> & {
  category: string;
  sync_status: string;
  user_id: string;
  vendor_id: string | null;
};

type RepairRecordMigrationPayload = {
  category: RepairRecord["category"];
  cost_amount: number | null;
  cost_currency: string;
  created_at: string;
  description: string | null;
  local_id: string;
  notes: string | null;
  odometer_reading: number | null;
  repair_date: string;
  sync_status: "synced";
  title: string;
  updated_at: string;
  user_id: string;
  vehicle_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  warranty_until_date: string | null;
  warranty_until_odometer: number | null;
};

export type RepairRecordMigrationItemStatus =
  | "already_migrated"
  | "failed"
  | "migrated"
  | "skipped_missing_vehicle_mapping";

export type RepairRecordMigrationItemResult = {
  cloudId: string | null;
  cloudVehicleId: string | null;
  errorMessage: string | null;
  localId: string;
  localVehicleId: string;
  status: RepairRecordMigrationItemStatus;
};

export type GuestRepairRecordMigrationResult = {
  failedCount: number;
  migratedCount: number;
  recalculatedVehicleCount: number;
  results: RepairRecordMigrationItemResult[];
  run: MigrationRun;
  skippedCount: number;
  skippedMissingVehicleMappingCount: number;
  totalRepairRecords: number;
};

const repairRecordSelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  repair_date,
  odometer_reading,
  title,
  category,
  description,
  vendor_id,
  vendor_name,
  cost_amount,
  cost_currency,
  warranty_until_date,
  warranty_until_odometer,
  notes,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapCloudRepairRecordRow = (row: CloudRepairRecordRow): RepairRecord => ({
  ...row,
  category: row.category as RepairRecord["category"],
  cost_amount:
    row.cost_amount === null || row.cost_amount === undefined
      ? row.cost_amount
      : Number(row.cost_amount),
  sync_status: row.sync_status as RepairRecord["sync_status"],
});

const formatCloudRepairRecordMigrationError = (
  action: string,
  error: CloudRepairRecordMigrationError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase repair_records table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql, then review packages/db/sql/004_verify_local_id_unique_constraints.sql before trying repair record migration.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to repair records. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated grants and RLS policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const isUniqueConflict = (error: CloudRepairRecordMigrationError) =>
  error.code === "23505" ||
  error.message.toLowerCase().includes("duplicate key");

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the public Supabase URL and anon key before migrating repair records.",
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
    throw new Error("Sign in before migrating repair records.");
  }

  if (data.user.id !== userId) {
    throw new Error("Signed-in account does not match the migration account.");
  }
};

const toRepairRecordMigrationPayload = ({
  cloudVehicleId,
  record,
  userId,
}: {
  cloudVehicleId: string;
  record: RepairRecord;
  userId: string;
}): RepairRecordMigrationPayload => ({
  category: record.category,
  cost_amount: optionalNumber(record.cost_amount),
  cost_currency: record.cost_currency || "USD",
  created_at: record.created_at,
  description: optionalText(record.description),
  local_id: record.local_id,
  notes: optionalText(record.notes),
  odometer_reading: optionalNumber(record.odometer_reading),
  repair_date: record.repair_date,
  sync_status: "synced",
  title: record.title,
  updated_at: record.updated_at,
  user_id: userId,
  vehicle_id: cloudVehicleId,
  vendor_id: null,
  vendor_name: optionalText(record.vendor_name),
  warranty_until_date: optionalText(record.warranty_until_date),
  warranty_until_odometer: optionalNumber(record.warranty_until_odometer),
});

const getCloudRepairRecordByLocalId = async (
  localId: string,
  userId: string,
): Promise<RepairRecord | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("repair_records")
    .select(repairRecordSelect)
    .eq("user_id", userId)
    .eq("local_id", localId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudRepairRecordMigrationError(
        "Unable to check migrated repair record",
        error,
      ),
    );
  }

  return data ? mapCloudRepairRecordRow(data as CloudRepairRecordRow) : null;
};

const insertMigratedCloudRepairRecord = async ({
  cloudVehicleId,
  record,
  userId,
}: {
  cloudVehicleId: string;
  record: RepairRecord;
  userId: string;
}): Promise<RepairRecord> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("repair_records")
    .insert(toRepairRecordMigrationPayload({ cloudVehicleId, record, userId }))
    .select(repairRecordSelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudRepairRecordMigrationError(
        "Unable to migrate repair record",
        error,
      ),
    );
  }

  return mapCloudRepairRecordRow(data as CloudRepairRecordRow);
};

const getVehicleMappingForRepairRecord = async ({
  record,
  vehicleMappingsByLocalId,
}: {
  record: RepairRecord;
  vehicleMappingsByLocalId: Map<string, MigrationEntityMapping>;
}) => {
  const localVehicle = await getVehicle(record.vehicle_id, {
    includeArchived: true,
  });
  const localVehicleLocalId = localVehicle?.local_id ?? record.vehicle_id;
  const mapping = vehicleMappingsByLocalId.get(localVehicleLocalId);

  return {
    localVehicleId: record.vehicle_id,
    localVehicleLocalId,
    mapping: mapping?.status === "synced" && mapping.cloud_id ? mapping : null,
  };
};

export const migrateGuestRepairRecordToCloud = async (
  record: RepairRecord,
  userId: string,
  vehicleMapping: MigrationEntityMapping | null,
  runId: string | null = null,
): Promise<RepairRecordMigrationItemResult> => {
  if (!vehicleMapping?.cloud_id) {
    const errorMessage =
      "Skipped because this repair record's vehicle has not been migrated to this account yet.";

    await upsertRepairRecordMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: record.local_id,
      runId,
      status: "skipped",
    });

    return {
      cloudId: null,
      cloudVehicleId: null,
      errorMessage,
      localId: record.local_id,
      localVehicleId: record.vehicle_id,
      status: "skipped_missing_vehicle_mapping",
    };
  }

  try {
    const cloudVehicle = await getCloudVehicleForOdometer(
      vehicleMapping.cloud_id,
      userId,
      { includeArchived: true },
    );

    if (!cloudVehicle) {
      throw new Error(
        "Mapped cloud vehicle was not found. Rerun vehicle migration before repair record migration.",
      );
    }

    const existingCloudRecord = await getCloudRepairRecordByLocalId(
      record.local_id,
      userId,
    );

    if (existingCloudRecord) {
      await upsertRepairRecordMigrationMapping({
        accountId: userId,
        cloudId: existingCloudRecord.id,
        localId: record.local_id,
        runId,
        status: "synced",
      });

      return {
        cloudId: existingCloudRecord.id,
        cloudVehicleId: existingCloudRecord.vehicle_id,
        errorMessage: null,
        localId: record.local_id,
        localVehicleId: record.vehicle_id,
        status: "already_migrated",
      };
    }

    const migratedRecord = await insertMigratedCloudRepairRecord({
      cloudVehicleId: cloudVehicle.id,
      record,
      userId,
    });

    await upsertRepairRecordMigrationMapping({
      accountId: userId,
      cloudId: migratedRecord.id,
      localId: record.local_id,
      runId,
      status: "synced",
    });

    return {
      cloudId: migratedRecord.id,
      cloudVehicleId: migratedRecord.vehicle_id,
      errorMessage: null,
      localId: record.local_id,
      localVehicleId: record.vehicle_id,
      status: "migrated",
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to migrate repair record.";

    if (
      error instanceof Error &&
      isUniqueConflict({ message: error.message })
    ) {
      const existingCloudRecord = await getCloudRepairRecordByLocalId(
        record.local_id,
        userId,
      );

      if (existingCloudRecord) {
        await upsertRepairRecordMigrationMapping({
          accountId: userId,
          cloudId: existingCloudRecord.id,
          localId: record.local_id,
          runId,
          status: "synced",
        });

        return {
          cloudId: existingCloudRecord.id,
          cloudVehicleId: existingCloudRecord.vehicle_id,
          errorMessage: null,
          localId: record.local_id,
          localVehicleId: record.vehicle_id,
          status: "already_migrated",
        };
      }
    }

    await upsertRepairRecordMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: record.local_id,
      runId,
      status: "failed",
    });

    return {
      cloudId: null,
      cloudVehicleId: vehicleMapping.cloud_id,
      errorMessage,
      localId: record.local_id,
      localVehicleId: record.vehicle_id,
      status: "failed",
    };
  }
};

const getRepairRecordMigrationRunStatus = ({
  failedRepairRecords,
  skippedRepairRecordsMissingVehicleMapping,
  totalRepairRecords,
}: Pick<
  MigrationRunRepairRecordCounts,
  | "failedRepairRecords"
  | "skippedRepairRecordsMissingVehicleMapping"
  | "totalRepairRecords"
>) => {
  if (
    failedRepairRecords === 0 &&
    skippedRepairRecordsMissingVehicleMapping === 0
  ) {
    return "completed";
  }

  if (
    failedRepairRecords + skippedRepairRecordsMissingVehicleMapping ===
    totalRepairRecords
  ) {
    return "failed";
  }

  return "completed_with_errors";
};

export const migrateGuestRepairRecordsToCloud = async (
  userId: string,
): Promise<GuestRepairRecordMigrationResult> => {
  await assertAuthenticatedUser(userId);

  const [records, vehicleMappings] = await Promise.all([
    listAllRepairRecords(),
    getVehicleMigrationMappings(userId),
  ]);
  const run = await createRepairRecordMigrationRun({
    accountId: userId,
    totalRepairRecords: records.length,
  });
  const vehicleMappingsByLocalId = new Map(
    vehicleMappings.map((mapping) => [mapping.local_id, mapping]),
  );
  const counts: MigrationRunRepairRecordCounts = {
    failedRepairRecords: 0,
    migratedRepairRecords: 0,
    skippedRepairRecords: 0,
    skippedRepairRecordsMissingVehicleMapping: 0,
    totalRepairRecords: records.length,
  };
  const results: RepairRecordMigrationItemResult[] = [];
  const affectedCloudVehicleIds = new Set<string>();

  for (const record of records) {
    const { mapping } = await getVehicleMappingForRepairRecord({
      record,
      vehicleMappingsByLocalId,
    });
    const result = await migrateGuestRepairRecordToCloud(
      record,
      userId,
      mapping,
      run.id,
    );

    results.push(result);

    if (result.status === "migrated") {
      counts.migratedRepairRecords += 1;
    } else if (result.status === "already_migrated") {
      counts.skippedRepairRecords += 1;
    } else if (result.status === "skipped_missing_vehicle_mapping") {
      counts.skippedRepairRecordsMissingVehicleMapping += 1;
    } else {
      counts.failedRepairRecords += 1;
    }

    if (result.cloudVehicleId) {
      affectedCloudVehicleIds.add(result.cloudVehicleId);
    }

    await updateRepairRecordMigrationRunStatus({
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
      counts.failedRepairRecords += 1;
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
  const finalStatus = getRepairRecordMigrationRunStatus(counts);
  const errorParts = [
    counts.failedRepairRecords > 0
      ? `${counts.failedRepairRecords} repair record migration issue${counts.failedRepairRecords === 1 ? "" : "s"} occurred`
      : null,
    counts.skippedRepairRecordsMissingVehicleMapping > 0
      ? `${counts.skippedRepairRecordsMissingVehicleMapping} repair record${counts.skippedRepairRecordsMissingVehicleMapping === 1 ? " was" : "s were"} skipped because vehicle migration mapping was missing`
      : null,
  ].filter(Boolean);
  const errorMessage =
    errorParts.length > 0
      ? `${errorParts.join("; ")}. Local data was not changed.`
      : null;

  await updateRepairRecordMigrationRunStatus({
    completedAt,
    counts,
    errorMessage,
    runId: run.id,
    status: finalStatus,
  });

  return {
    failedCount: counts.failedRepairRecords,
    migratedCount: counts.migratedRepairRecords,
    recalculatedVehicleCount: affectedCloudVehicleIds.size,
    results,
    run: {
      ...run,
      completed_at: completedAt,
      error_message: errorMessage,
      failed_repair_records: counts.failedRepairRecords,
      migrated_repair_records: counts.migratedRepairRecords,
      skipped_repair_records: counts.skippedRepairRecords,
      skipped_repair_records_missing_vehicle_mapping:
        counts.skippedRepairRecordsMissingVehicleMapping,
      status: finalStatus,
      total_repair_records: counts.totalRepairRecords,
      updated_at: completedAt,
    },
    skippedCount: counts.skippedRepairRecords,
    skippedMissingVehicleMappingCount:
      counts.skippedRepairRecordsMissingVehicleMapping,
    totalRepairRecords: counts.totalRepairRecords,
  };
};

export { getRepairRecordMigrationMappings };
