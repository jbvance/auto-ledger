import { createLocalId, getGuestDatabase } from "./database";

export type GuestMigrationSummaryCounts = {
  activeVehicles: number;
  archivedVehicles: number;
  attachments: number;
  completedReminders: number;
  maintenanceReminders: number;
  odometerEntries: number;
  repairRecords: number;
  serviceRecords: number;
  totalRecords: number;
  totalVehicles: number;
};

export type GuestMigrationWarningCode =
  | "account_required"
  | "archived_vehicles_present"
  | "attachments_require_upload";

export type GuestMigrationWarning = {
  code: GuestMigrationWarningCode;
  message: string;
};

export type GuestMigrationSummary = {
  accountId: string | null;
  counts: GuestMigrationSummaryCounts;
  hasGuestData: boolean;
  warnings: GuestMigrationWarning[];
};

export type MigrationRunStatus =
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "not_started"
  | "pending"
  | "running"
  | "skipped"
  | "synced";

export type MigrationEntityType =
  | "attachment"
  | "maintenance_reminder"
  | "odometer_entry"
  | "repair_record"
  | "service_record"
  | "vehicle";

export type MigrationRun = {
  account_id: string;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
  failed_odometer_entries: number;
  failed_service_records: number;
  failed_vehicles: number;
  id: string;
  migrated_odometer_entries: number;
  migrated_service_records: number;
  migrated_vehicles: number;
  migration_scope: string;
  skipped_odometer_entries: number;
  skipped_odometer_entries_missing_vehicle_mapping: number;
  skipped_service_records: number;
  skipped_service_records_missing_vehicle_mapping: number;
  started_at: string;
  status: MigrationRunStatus;
  skipped_vehicles: number;
  total_odometer_entries: number;
  total_service_records: number;
  total_vehicles: number;
  updated_at: string;
};

export type MigrationEntityMapping = {
  account_id: string;
  cloud_id: string | null;
  created_at: string;
  entity_type: MigrationEntityType;
  error_message: string | null;
  id: string;
  local_id: string;
  run_id: string | null;
  status: MigrationRunStatus;
  updated_at: string;
};

export type MigrationEntityMappingInput = {
  accountId: string;
  cloudId: string | null;
  entityType: MigrationEntityType;
  errorMessage?: string | null;
  localId: string;
  runId?: string | null;
  status: MigrationRunStatus;
};

export type VehicleMigrationMappingInput = Omit<
  MigrationEntityMappingInput,
  "entityType"
>;

export type MigrationRunVehicleCounts = {
  failedVehicles: number;
  migratedVehicles: number;
  skippedVehicles: number;
  totalVehicles: number;
};

export type MigrationRunOdometerCounts = {
  failedOdometerEntries: number;
  migratedOdometerEntries: number;
  skippedOdometerEntries: number;
  skippedOdometerEntriesMissingVehicleMapping: number;
  totalOdometerEntries: number;
};

export type MigrationRunServiceRecordCounts = {
  failedServiceRecords: number;
  migratedServiceRecords: number;
  skippedServiceRecords: number;
  skippedServiceRecordsMissingVehicleMapping: number;
  totalServiceRecords: number;
};

type CountRow = {
  count: number;
};

const countRows = async (query: string) => {
  const db = await getGuestDatabase();
  const row = await db.getFirstAsync<CountRow>(query);

  return row?.count ?? 0;
};

export const buildGuestMigrationSummary = ({
  accountId = null,
  counts,
}: {
  accountId?: string | null;
  counts: Omit<GuestMigrationSummaryCounts, "totalRecords" | "totalVehicles">;
}): GuestMigrationSummary => {
  const totalVehicles = counts.activeVehicles + counts.archivedVehicles;
  const totalRecords =
    totalVehicles +
    counts.odometerEntries +
    counts.serviceRecords +
    counts.repairRecords +
    counts.maintenanceReminders +
    counts.attachments;
  const nextCounts: GuestMigrationSummaryCounts = {
    ...counts,
    totalRecords,
    totalVehicles,
  };
  const hasGuestData = totalRecords > 0;
  const warnings: GuestMigrationWarning[] = [];

  if (hasGuestData && !accountId) {
    warnings.push({
      code: "account_required",
      message:
        "Sign in before migration tools can review local records for cloud upload.",
    });
  }

  if (counts.archivedVehicles > 0) {
    warnings.push({
      code: "archived_vehicles_present",
      message:
        "Archived vehicles are stored locally and will need to be reviewed during migration.",
    });
  }

  if (counts.attachments > 0) {
    warnings.push({
      code: "attachments_require_upload",
      message:
        "Local photo and PDF attachments will require file upload in a later migration step.",
    });
  }

  return {
    accountId,
    counts: nextCounts,
    hasGuestData,
    warnings,
  };
};

export const getGuestMigrationSummary = async (
  accountId: string | null = null,
): Promise<GuestMigrationSummary> => {
  const [
    activeVehicles,
    archivedVehicles,
    odometerEntries,
    serviceRecords,
    repairRecords,
    maintenanceReminders,
    completedReminders,
    attachments,
  ] = await Promise.all([
    countRows(
      `SELECT COUNT(*) as count FROM vehicles WHERE archived_at IS NULL`,
    ),
    countRows(
      `SELECT COUNT(*) as count FROM vehicles WHERE archived_at IS NOT NULL`,
    ),
    countRows(`SELECT COUNT(*) as count FROM odometer_entries`),
    countRows(`SELECT COUNT(*) as count FROM service_records`),
    countRows(`SELECT COUNT(*) as count FROM repair_records`),
    countRows(`SELECT COUNT(*) as count FROM maintenance_reminders`),
    countRows(
      `SELECT COUNT(*) as count FROM maintenance_reminders WHERE is_completed = 1`,
    ),
    countRows(`SELECT COUNT(*) as count FROM record_attachments`),
  ]);

  return buildGuestMigrationSummary({
    accountId,
    counts: {
      activeVehicles,
      archivedVehicles,
      attachments,
      completedReminders,
      maintenanceReminders,
      odometerEntries,
      repairRecords,
      serviceRecords,
    },
  });
};

export const getLatestMigrationRunForAccount = async (
  accountId: string,
): Promise<MigrationRun | null> => {
  const db = await getGuestDatabase();
  const row = await db.getFirstAsync<MigrationRun>(
    `SELECT *
     FROM migration_runs
     WHERE account_id = ?
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    accountId,
  );

  return row ?? null;
};

export const getOrCreateInitialMigrationRun = async (
  accountId: string,
): Promise<MigrationRun> => {
  const existing = await getLatestMigrationRunForAccount(accountId);

  if (existing) {
    return existing;
  }

  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const run: MigrationRun = {
    account_id: accountId,
    completed_at: null,
    created_at: now,
    error_message: null,
    failed_odometer_entries: 0,
    failed_service_records: 0,
    failed_vehicles: 0,
    id: createLocalId("migration_run"),
    migrated_odometer_entries: 0,
    migrated_service_records: 0,
    migrated_vehicles: 0,
    migration_scope: "full",
    skipped_odometer_entries: 0,
    skipped_odometer_entries_missing_vehicle_mapping: 0,
    skipped_service_records: 0,
    skipped_service_records_missing_vehicle_mapping: 0,
    started_at: now,
    status: "not_started",
    skipped_vehicles: 0,
    total_odometer_entries: 0,
    total_service_records: 0,
    total_vehicles: 0,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO migration_runs (
      id,
      account_id,
      migration_scope,
      started_at,
      completed_at,
      status,
      total_vehicles,
      migrated_vehicles,
      skipped_vehicles,
      failed_vehicles,
      total_odometer_entries,
      migrated_odometer_entries,
      skipped_odometer_entries,
      skipped_odometer_entries_missing_vehicle_mapping,
      failed_odometer_entries,
      error_message,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.id,
      run.account_id,
      run.migration_scope,
      run.started_at,
      run.completed_at,
      run.status,
      run.total_vehicles,
      run.migrated_vehicles,
      run.skipped_vehicles,
      run.failed_vehicles,
      run.total_odometer_entries,
      run.migrated_odometer_entries,
      run.skipped_odometer_entries,
      run.skipped_odometer_entries_missing_vehicle_mapping,
      run.failed_odometer_entries,
      run.error_message,
      run.created_at,
      run.updated_at,
    ],
  );

  return run;
};

export const createVehicleMigrationRun = async ({
  accountId,
  totalVehicles,
}: {
  accountId: string;
  totalVehicles: number;
}): Promise<MigrationRun> => {
  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const run: MigrationRun = {
    account_id: accountId,
    completed_at: null,
    created_at: now,
    error_message: null,
    failed_odometer_entries: 0,
    failed_service_records: 0,
    failed_vehicles: 0,
    id: createLocalId("migration_run"),
    migrated_odometer_entries: 0,
    migrated_service_records: 0,
    migrated_vehicles: 0,
    migration_scope: "vehicles",
    skipped_odometer_entries: 0,
    skipped_odometer_entries_missing_vehicle_mapping: 0,
    skipped_service_records: 0,
    skipped_service_records_missing_vehicle_mapping: 0,
    skipped_vehicles: 0,
    started_at: now,
    status: "running",
    total_odometer_entries: 0,
    total_service_records: 0,
    total_vehicles: totalVehicles,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO migration_runs (
      id,
      account_id,
      migration_scope,
      started_at,
      completed_at,
      status,
      total_vehicles,
      migrated_vehicles,
      skipped_vehicles,
      failed_vehicles,
      error_message,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.id,
      run.account_id,
      run.migration_scope,
      run.started_at,
      run.completed_at,
      run.status,
      run.total_vehicles,
      run.migrated_vehicles,
      run.skipped_vehicles,
      run.failed_vehicles,
      run.error_message,
      run.created_at,
      run.updated_at,
    ],
  );

  return run;
};

export const createOdometerMigrationRun = async ({
  accountId,
  totalOdometerEntries,
}: {
  accountId: string;
  totalOdometerEntries: number;
}): Promise<MigrationRun> => {
  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const run: MigrationRun = {
    account_id: accountId,
    completed_at: null,
    created_at: now,
    error_message: null,
    failed_odometer_entries: 0,
    failed_service_records: 0,
    failed_vehicles: 0,
    id: createLocalId("migration_run"),
    migrated_odometer_entries: 0,
    migrated_service_records: 0,
    migrated_vehicles: 0,
    migration_scope: "odometer_entries",
    skipped_odometer_entries: 0,
    skipped_odometer_entries_missing_vehicle_mapping: 0,
    skipped_service_records: 0,
    skipped_service_records_missing_vehicle_mapping: 0,
    skipped_vehicles: 0,
    started_at: now,
    status: "running",
    total_odometer_entries: totalOdometerEntries,
    total_service_records: 0,
    total_vehicles: 0,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO migration_runs (
      id,
      account_id,
      migration_scope,
      started_at,
      completed_at,
      status,
      total_vehicles,
      migrated_vehicles,
      skipped_vehicles,
      failed_vehicles,
      total_odometer_entries,
      migrated_odometer_entries,
      skipped_odometer_entries,
      skipped_odometer_entries_missing_vehicle_mapping,
      failed_odometer_entries,
      error_message,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.id,
      run.account_id,
      run.migration_scope,
      run.started_at,
      run.completed_at,
      run.status,
      run.total_vehicles,
      run.migrated_vehicles,
      run.skipped_vehicles,
      run.failed_vehicles,
      run.total_odometer_entries,
      run.migrated_odometer_entries,
      run.skipped_odometer_entries,
      run.skipped_odometer_entries_missing_vehicle_mapping,
      run.failed_odometer_entries,
      run.error_message,
      run.created_at,
      run.updated_at,
    ],
  );

  return run;
};

export const createServiceRecordMigrationRun = async ({
  accountId,
  totalServiceRecords,
}: {
  accountId: string;
  totalServiceRecords: number;
}): Promise<MigrationRun> => {
  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const run: MigrationRun = {
    account_id: accountId,
    completed_at: null,
    created_at: now,
    error_message: null,
    failed_odometer_entries: 0,
    failed_service_records: 0,
    failed_vehicles: 0,
    id: createLocalId("migration_run"),
    migrated_odometer_entries: 0,
    migrated_service_records: 0,
    migrated_vehicles: 0,
    migration_scope: "service_records",
    skipped_odometer_entries: 0,
    skipped_odometer_entries_missing_vehicle_mapping: 0,
    skipped_service_records: 0,
    skipped_service_records_missing_vehicle_mapping: 0,
    skipped_vehicles: 0,
    started_at: now,
    status: "running",
    total_odometer_entries: 0,
    total_service_records: totalServiceRecords,
    total_vehicles: 0,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO migration_runs (
      id,
      account_id,
      migration_scope,
      started_at,
      completed_at,
      status,
      total_vehicles,
      migrated_vehicles,
      skipped_vehicles,
      failed_vehicles,
      total_odometer_entries,
      migrated_odometer_entries,
      skipped_odometer_entries,
      skipped_odometer_entries_missing_vehicle_mapping,
      failed_odometer_entries,
      total_service_records,
      migrated_service_records,
      skipped_service_records,
      skipped_service_records_missing_vehicle_mapping,
      failed_service_records,
      error_message,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.id,
      run.account_id,
      run.migration_scope,
      run.started_at,
      run.completed_at,
      run.status,
      run.total_vehicles,
      run.migrated_vehicles,
      run.skipped_vehicles,
      run.failed_vehicles,
      run.total_odometer_entries,
      run.migrated_odometer_entries,
      run.skipped_odometer_entries,
      run.skipped_odometer_entries_missing_vehicle_mapping,
      run.failed_odometer_entries,
      run.total_service_records,
      run.migrated_service_records,
      run.skipped_service_records,
      run.skipped_service_records_missing_vehicle_mapping,
      run.failed_service_records,
      run.error_message,
      run.created_at,
      run.updated_at,
    ],
  );

  return run;
};

export const updateMigrationRunStatus = async ({
  completedAt = null,
  counts,
  errorMessage = null,
  runId,
  status,
}: {
  completedAt?: string | null;
  counts: MigrationRunVehicleCounts;
  errorMessage?: string | null;
  runId: string;
  status: MigrationRunStatus;
}): Promise<void> => {
  const db = await getGuestDatabase();

  await db.runAsync(
    `UPDATE migration_runs
     SET completed_at = ?,
         status = ?,
         total_vehicles = ?,
         migrated_vehicles = ?,
         skipped_vehicles = ?,
         failed_vehicles = ?,
         error_message = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      completedAt,
      status,
      counts.totalVehicles,
      counts.migratedVehicles,
      counts.skippedVehicles,
      counts.failedVehicles,
      errorMessage,
      new Date().toISOString(),
      runId,
    ],
  );
};

export const updateOdometerMigrationRunStatus = async ({
  completedAt = null,
  counts,
  errorMessage = null,
  runId,
  status,
}: {
  completedAt?: string | null;
  counts: MigrationRunOdometerCounts;
  errorMessage?: string | null;
  runId: string;
  status: MigrationRunStatus;
}): Promise<void> => {
  const db = await getGuestDatabase();

  await db.runAsync(
    `UPDATE migration_runs
     SET completed_at = ?,
         status = ?,
         total_odometer_entries = ?,
         migrated_odometer_entries = ?,
         skipped_odometer_entries = ?,
         skipped_odometer_entries_missing_vehicle_mapping = ?,
         failed_odometer_entries = ?,
         error_message = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      completedAt,
      status,
      counts.totalOdometerEntries,
      counts.migratedOdometerEntries,
      counts.skippedOdometerEntries,
      counts.skippedOdometerEntriesMissingVehicleMapping,
      counts.failedOdometerEntries,
      errorMessage,
      new Date().toISOString(),
      runId,
    ],
  );
};

export const updateServiceRecordMigrationRunStatus = async ({
  completedAt = null,
  counts,
  errorMessage = null,
  runId,
  status,
}: {
  completedAt?: string | null;
  counts: MigrationRunServiceRecordCounts;
  errorMessage?: string | null;
  runId: string;
  status: MigrationRunStatus;
}): Promise<void> => {
  const db = await getGuestDatabase();

  await db.runAsync(
    `UPDATE migration_runs
     SET completed_at = ?,
         status = ?,
         total_service_records = ?,
         migrated_service_records = ?,
         skipped_service_records = ?,
         skipped_service_records_missing_vehicle_mapping = ?,
         failed_service_records = ?,
         error_message = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      completedAt,
      status,
      counts.totalServiceRecords,
      counts.migratedServiceRecords,
      counts.skippedServiceRecords,
      counts.skippedServiceRecordsMissingVehicleMapping,
      counts.failedServiceRecords,
      errorMessage,
      new Date().toISOString(),
      runId,
    ],
  );
};

export const getMigrationEntityMapping = async ({
  accountId,
  entityType,
  localId,
}: {
  accountId: string;
  entityType: MigrationEntityType;
  localId: string;
}): Promise<MigrationEntityMapping | null> => {
  const db = await getGuestDatabase();
  const row = await db.getFirstAsync<MigrationEntityMapping>(
    `SELECT *
     FROM migration_entity_mappings
     WHERE account_id = ?
       AND entity_type = ?
       AND local_id = ?
     LIMIT 1`,
    accountId,
    entityType,
    localId,
  );

  return row ?? null;
};

export const getVehicleMigrationMappings = async (
  accountId: string,
): Promise<MigrationEntityMapping[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<MigrationEntityMapping>(
    `SELECT *
     FROM migration_entity_mappings
     WHERE account_id = ?
       AND entity_type = 'vehicle'
     ORDER BY updated_at DESC, created_at DESC`,
    accountId,
  );

  return rows;
};

export const getOdometerMigrationMappings = async (
  accountId: string,
): Promise<MigrationEntityMapping[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<MigrationEntityMapping>(
    `SELECT *
     FROM migration_entity_mappings
     WHERE account_id = ?
       AND entity_type = 'odometer_entry'
     ORDER BY updated_at DESC, created_at DESC`,
    accountId,
  );

  return rows;
};

export const getServiceRecordMigrationMappings = async (
  accountId: string,
): Promise<MigrationEntityMapping[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<MigrationEntityMapping>(
    `SELECT *
     FROM migration_entity_mappings
     WHERE account_id = ?
       AND entity_type = 'service_record'
     ORDER BY updated_at DESC, created_at DESC`,
    accountId,
  );

  return rows;
};

export const upsertMigrationEntityMapping = async ({
  accountId,
  cloudId,
  entityType,
  errorMessage = null,
  localId,
  runId = null,
  status,
}: MigrationEntityMappingInput): Promise<MigrationEntityMapping> => {
  const existing = await getMigrationEntityMapping({
    accountId,
    entityType,
    localId,
  });
  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const mapping: MigrationEntityMapping = {
    account_id: accountId,
    cloud_id: cloudId,
    created_at: existing?.created_at ?? now,
    entity_type: entityType,
    error_message: errorMessage,
    id: existing?.id ?? createLocalId("migration_mapping"),
    local_id: localId,
    run_id: runId,
    status,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO migration_entity_mappings (
      id,
      run_id,
      account_id,
      entity_type,
      local_id,
      cloud_id,
      status,
      error_message,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, entity_type, local_id)
    DO UPDATE SET
      run_id = excluded.run_id,
      cloud_id = excluded.cloud_id,
      status = excluded.status,
      error_message = excluded.error_message,
      updated_at = excluded.updated_at`,
    [
      mapping.id,
      mapping.run_id,
      mapping.account_id,
      mapping.entity_type,
      mapping.local_id,
      mapping.cloud_id,
      mapping.status,
      mapping.error_message,
      mapping.created_at,
      mapping.updated_at,
    ],
  );

  return mapping;
};

export const upsertVehicleMigrationMapping = async (
  input: VehicleMigrationMappingInput,
): Promise<MigrationEntityMapping> =>
  upsertMigrationEntityMapping({
    ...input,
    entityType: "vehicle",
  });

export const upsertOdometerMigrationMapping = async (
  input: VehicleMigrationMappingInput,
): Promise<MigrationEntityMapping> =>
  upsertMigrationEntityMapping({
    ...input,
    entityType: "odometer_entry",
  });

export const upsertServiceRecordMigrationMapping = async (
  input: VehicleMigrationMappingInput,
): Promise<MigrationEntityMapping> =>
  upsertMigrationEntityMapping({
    ...input,
    entityType: "service_record",
  });
