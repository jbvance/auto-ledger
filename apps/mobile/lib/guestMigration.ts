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
  | "failed"
  | "not_started"
  | "pending"
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
  id: string;
  started_at: string;
  status: MigrationRunStatus;
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
        "Sign in before a future migration tool can review local records for cloud upload.",
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
    countRows(`SELECT COUNT(*) as count FROM vehicles WHERE archived_at IS NULL`),
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
    id: createLocalId("migration_run"),
    started_at: now,
    status: "not_started",
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO migration_runs (
      id,
      account_id,
      started_at,
      completed_at,
      status,
      error_message,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.id,
      run.account_id,
      run.started_at,
      run.completed_at,
      run.status,
      run.error_message,
      run.created_at,
      run.updated_at,
    ],
  );

  return run;
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
