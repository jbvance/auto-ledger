import type { ServiceRecord } from "@autoledger/shared";

import {
  getCloudVehicleForOdometer,
  recalculateCloudVehicleOdometer,
} from "./cloudVehicleOdometer";
import {
  createServiceRecordMigrationRun,
  getServiceRecordMigrationMappings,
  getVehicleMigrationMappings,
  updateServiceRecordMigrationRunStatus,
  upsertServiceRecordMigrationMapping,
  type MigrationEntityMapping,
  type MigrationRun,
  type MigrationRunServiceRecordCounts,
} from "./guestMigration";
import { listAllServiceRecords } from "./serviceRecords";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

type CloudServiceRecordMigrationError = {
  code?: string;
  message: string;
};

type CloudServiceRecordRow = Omit<ServiceRecord, "category" | "sync_status"> & {
  category: string;
  sync_status: string;
  user_id: string;
  vendor_id: string | null;
};

type ServiceRecordMigrationPayload = {
  category: ServiceRecord["category"];
  cost_amount: number | null;
  cost_currency: string;
  created_at: string;
  description: string | null;
  local_id: string;
  notes: string | null;
  odometer_reading: number | null;
  service_date: string;
  sync_status: "synced";
  title: string;
  updated_at: string;
  user_id: string;
  vehicle_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
};

export type ServiceRecordMigrationItemStatus =
  | "already_migrated"
  | "failed"
  | "migrated"
  | "skipped_missing_vehicle_mapping";

export type ServiceRecordMigrationItemResult = {
  cloudId: string | null;
  cloudVehicleId: string | null;
  errorMessage: string | null;
  localId: string;
  localVehicleId: string;
  status: ServiceRecordMigrationItemStatus;
};

export type GuestServiceRecordMigrationResult = {
  failedCount: number;
  migratedCount: number;
  recalculatedVehicleCount: number;
  results: ServiceRecordMigrationItemResult[];
  run: MigrationRun;
  skippedCount: number;
  skippedMissingVehicleMappingCount: number;
  totalServiceRecords: number;
};

const serviceRecordSelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  service_date,
  odometer_reading,
  title,
  category,
  description,
  vendor_id,
  vendor_name,
  cost_amount,
  cost_currency,
  notes,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapCloudServiceRecordRow = (
  row: CloudServiceRecordRow,
): ServiceRecord => ({
  ...row,
  category: row.category as ServiceRecord["category"],
  cost_amount:
    row.cost_amount === null || row.cost_amount === undefined
      ? row.cost_amount
      : Number(row.cost_amount),
  sync_status: row.sync_status as ServiceRecord["sync_status"],
});

const formatCloudServiceRecordMigrationError = (
  action: string,
  error: CloudServiceRecordMigrationError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase service_records table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql, then review packages/db/sql/004_verify_local_id_unique_constraints.sql before trying service record migration.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to service records. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated grants and RLS policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const isUniqueConflict = (error: CloudServiceRecordMigrationError) =>
  error.code === "23505" ||
  error.message.toLowerCase().includes("duplicate key");

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the public Supabase URL and anon key before migrating service records.",
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
    throw new Error("Sign in before migrating service records.");
  }

  if (data.user.id !== userId) {
    throw new Error("Signed-in account does not match the migration account.");
  }
};

const toServiceRecordMigrationPayload = ({
  cloudVehicleId,
  record,
  userId,
}: {
  cloudVehicleId: string;
  record: ServiceRecord;
  userId: string;
}): ServiceRecordMigrationPayload => ({
  category: record.category,
  cost_amount: optionalNumber(record.cost_amount),
  cost_currency: record.cost_currency || "USD",
  created_at: record.created_at,
  description: optionalText(record.description),
  local_id: record.local_id,
  notes: optionalText(record.notes),
  odometer_reading: optionalNumber(record.odometer_reading),
  service_date: record.service_date,
  sync_status: "synced",
  title: record.title,
  updated_at: record.updated_at,
  user_id: userId,
  vehicle_id: cloudVehicleId,
  vendor_id: null,
  vendor_name: optionalText(record.vendor_name),
});

const getCloudServiceRecordByLocalId = async (
  localId: string,
  userId: string,
): Promise<ServiceRecord | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("service_records")
    .select(serviceRecordSelect)
    .eq("user_id", userId)
    .eq("local_id", localId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudServiceRecordMigrationError(
        "Unable to check migrated service record",
        error,
      ),
    );
  }

  return data ? mapCloudServiceRecordRow(data as CloudServiceRecordRow) : null;
};

const insertMigratedCloudServiceRecord = async ({
  cloudVehicleId,
  record,
  userId,
}: {
  cloudVehicleId: string;
  record: ServiceRecord;
  userId: string;
}): Promise<ServiceRecord> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("service_records")
    .insert(toServiceRecordMigrationPayload({ cloudVehicleId, record, userId }))
    .select(serviceRecordSelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudServiceRecordMigrationError(
        "Unable to migrate service record",
        error,
      ),
    );
  }

  return mapCloudServiceRecordRow(data as CloudServiceRecordRow);
};

const getVehicleMappingForServiceRecord = async ({
  record,
  vehicleMappingsByLocalId,
}: {
  record: ServiceRecord;
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

export const migrateGuestServiceRecordToCloud = async (
  record: ServiceRecord,
  userId: string,
  vehicleMapping: MigrationEntityMapping | null,
  runId: string | null = null,
): Promise<ServiceRecordMigrationItemResult> => {
  if (!vehicleMapping?.cloud_id) {
    const errorMessage =
      "Skipped because this service record's vehicle has not been migrated to this account yet.";

    await upsertServiceRecordMigrationMapping({
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
        "Mapped cloud vehicle was not found. Rerun vehicle migration before service record migration.",
      );
    }

    const existingCloudRecord = await getCloudServiceRecordByLocalId(
      record.local_id,
      userId,
    );

    if (existingCloudRecord) {
      await upsertServiceRecordMigrationMapping({
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

    const migratedRecord = await insertMigratedCloudServiceRecord({
      cloudVehicleId: cloudVehicle.id,
      record,
      userId,
    });

    await upsertServiceRecordMigrationMapping({
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
        : "Unable to migrate service record.";

    if (
      error instanceof Error &&
      isUniqueConflict({ message: error.message })
    ) {
      const existingCloudRecord = await getCloudServiceRecordByLocalId(
        record.local_id,
        userId,
      );

      if (existingCloudRecord) {
        await upsertServiceRecordMigrationMapping({
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

    await upsertServiceRecordMigrationMapping({
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

const getServiceRecordMigrationRunStatus = ({
  failedServiceRecords,
  skippedServiceRecordsMissingVehicleMapping,
  totalServiceRecords,
}: Pick<
  MigrationRunServiceRecordCounts,
  | "failedServiceRecords"
  | "skippedServiceRecordsMissingVehicleMapping"
  | "totalServiceRecords"
>) => {
  if (
    failedServiceRecords === 0 &&
    skippedServiceRecordsMissingVehicleMapping === 0
  ) {
    return "completed";
  }

  if (
    failedServiceRecords + skippedServiceRecordsMissingVehicleMapping ===
    totalServiceRecords
  ) {
    return "failed";
  }

  return "completed_with_errors";
};

export const migrateGuestServiceRecordsToCloud = async (
  userId: string,
): Promise<GuestServiceRecordMigrationResult> => {
  await assertAuthenticatedUser(userId);

  const [records, vehicleMappings] = await Promise.all([
    listAllServiceRecords(),
    getVehicleMigrationMappings(userId),
  ]);
  const run = await createServiceRecordMigrationRun({
    accountId: userId,
    totalServiceRecords: records.length,
  });
  const vehicleMappingsByLocalId = new Map(
    vehicleMappings.map((mapping) => [mapping.local_id, mapping]),
  );
  const counts: MigrationRunServiceRecordCounts = {
    failedServiceRecords: 0,
    migratedServiceRecords: 0,
    skippedServiceRecords: 0,
    skippedServiceRecordsMissingVehicleMapping: 0,
    totalServiceRecords: records.length,
  };
  const results: ServiceRecordMigrationItemResult[] = [];
  const affectedCloudVehicleIds = new Set<string>();

  for (const record of records) {
    const { mapping } = await getVehicleMappingForServiceRecord({
      record,
      vehicleMappingsByLocalId,
    });
    const result = await migrateGuestServiceRecordToCloud(
      record,
      userId,
      mapping,
      run.id,
    );

    results.push(result);

    if (result.status === "migrated") {
      counts.migratedServiceRecords += 1;
    } else if (result.status === "already_migrated") {
      counts.skippedServiceRecords += 1;
    } else if (result.status === "skipped_missing_vehicle_mapping") {
      counts.skippedServiceRecordsMissingVehicleMapping += 1;
    } else {
      counts.failedServiceRecords += 1;
    }

    if (result.cloudVehicleId) {
      affectedCloudVehicleIds.add(result.cloudVehicleId);
    }

    await updateServiceRecordMigrationRunStatus({
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
      counts.failedServiceRecords += 1;
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
  const finalStatus = getServiceRecordMigrationRunStatus(counts);
  const errorParts = [
    counts.failedServiceRecords > 0
      ? `${counts.failedServiceRecords} service record migration issue${counts.failedServiceRecords === 1 ? "" : "s"} occurred`
      : null,
    counts.skippedServiceRecordsMissingVehicleMapping > 0
      ? `${counts.skippedServiceRecordsMissingVehicleMapping} service record${counts.skippedServiceRecordsMissingVehicleMapping === 1 ? " was" : "s were"} skipped because vehicle migration mapping was missing`
      : null,
  ].filter(Boolean);
  const errorMessage =
    errorParts.length > 0
      ? `${errorParts.join("; ")}. Local data was not changed.`
      : null;

  await updateServiceRecordMigrationRunStatus({
    completedAt,
    counts,
    errorMessage,
    runId: run.id,
    status: finalStatus,
  });

  return {
    failedCount: counts.failedServiceRecords,
    migratedCount: counts.migratedServiceRecords,
    recalculatedVehicleCount: affectedCloudVehicleIds.size,
    results,
    run: {
      ...run,
      completed_at: completedAt,
      error_message: errorMessage,
      failed_service_records: counts.failedServiceRecords,
      migrated_service_records: counts.migratedServiceRecords,
      skipped_service_records: counts.skippedServiceRecords,
      skipped_service_records_missing_vehicle_mapping:
        counts.skippedServiceRecordsMissingVehicleMapping,
      status: finalStatus,
      total_service_records: counts.totalServiceRecords,
      updated_at: completedAt,
    },
    skippedCount: counts.skippedServiceRecords,
    skippedMissingVehicleMappingCount:
      counts.skippedServiceRecordsMissingVehicleMapping,
    totalServiceRecords: counts.totalServiceRecords,
  };
};

export { getServiceRecordMigrationMappings };
