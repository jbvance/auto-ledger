import { getGuestDatabase } from "./database";
import {
  buildGuestMigrationSummary,
  countSyncedMigrationMappings,
  getLatestMigrationRunForAccountByScope,
  getLatestMigrationRunsByScopeForAccount,
  getMaintenanceReminderMigrationMappings,
  getRepairRecordMigrationMappings,
  getServiceRecordMigrationMappings,
  getVehicleMigrationMappings,
  getGuestMigrationSummary,
  getOrCreateInitialMigrationRun,
  upsertMaintenanceReminderMigrationMapping,
  upsertRepairRecordMigrationMapping,
  upsertServiceRecordMigrationMapping,
  upsertVehicleMigrationMapping,
  type MigrationRun,
} from "./guestMigration";

jest.mock("./database", () => ({
  createLocalId: jest.fn((prefix: string) => `${prefix}_test_id`),
  getGuestDatabase: jest.fn(),
}));

type CountKey =
  | "activeVehicles"
  | "archivedVehicles"
  | "attachments"
  | "completedReminders"
  | "maintenanceReminders"
  | "odometerEntries"
  | "repairRecords"
  | "serviceRecords";

const emptyCounts: Record<CountKey, number> = {
  activeVehicles: 0,
  archivedVehicles: 0,
  attachments: 0,
  completedReminders: 0,
  maintenanceReminders: 0,
  odometerEntries: 0,
  repairRecords: 0,
  serviceRecords: 0,
};

const queryKeyFor = (query: string): CountKey | null => {
  if (
    query.includes("FROM vehicles") &&
    query.includes("archived_at IS NULL")
  ) {
    return "activeVehicles";
  }

  if (
    query.includes("FROM vehicles") &&
    query.includes("archived_at IS NOT NULL")
  ) {
    return "archivedVehicles";
  }

  if (query.includes("FROM odometer_entries")) {
    return "odometerEntries";
  }

  if (query.includes("FROM service_records")) {
    return "serviceRecords";
  }

  if (query.includes("FROM repair_records")) {
    return "repairRecords";
  }

  if (
    query.includes("FROM maintenance_reminders") &&
    query.includes("is_completed = 1")
  ) {
    return "completedReminders";
  }

  if (query.includes("FROM maintenance_reminders")) {
    return "maintenanceReminders";
  }

  if (query.includes("FROM record_attachments")) {
    return "attachments";
  }

  return null;
};

const createMockDatabase = (counts: Partial<Record<CountKey, number>> = {}) => {
  const nextCounts = { ...emptyCounts, ...counts };

  return {
    getAllAsync: jest.fn(async (): Promise<unknown[]> => []),
    getFirstAsync: jest.fn(async (query: string) => {
      const key = queryKeyFor(query);

      return key ? { count: nextCounts[key] } : null;
    }),
    runAsync: jest.fn(async () => undefined),
  };
};

const createMigrationRunRow = (
  overrides: Partial<MigrationRun> = {},
): MigrationRun => ({
  account_id: "user_1",
  completed_at: "2026-05-02T00:01:00.000Z",
  created_at: "2026-05-02T00:00:00.000Z",
  error_message: null,
  failed_odometer_entries: 0,
  failed_repair_records: 0,
  failed_service_records: 0,
  failed_vehicles: 0,
  id: "run_1",
  migrated_odometer_entries: 0,
  migrated_repair_records: 0,
  migrated_service_records: 0,
  migrated_vehicles: 1,
  migration_scope: "vehicles",
  skipped_odometer_entries: 0,
  skipped_odometer_entries_missing_vehicle_mapping: 0,
  skipped_repair_records: 0,
  skipped_repair_records_missing_vehicle_mapping: 0,
  skipped_service_records: 0,
  skipped_service_records_missing_vehicle_mapping: 0,
  skipped_vehicles: 0,
  started_at: "2026-05-02T00:00:00.000Z",
  status: "completed",
  total_odometer_entries: 0,
  total_repair_records: 0,
  total_service_records: 0,
  total_vehicles: 1,
  updated_at: "2026-05-02T00:01:00.000Z",
  ...overrides,
});

const mockedGetGuestDatabase = jest.mocked(getGuestDatabase);

describe("guest migration summary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an empty state with no local guest data", async () => {
    const db = createMockDatabase();
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const summary = await getGuestMigrationSummary("user_1");

    expect(summary.hasGuestData).toBe(false);
    expect(summary.counts).toMatchObject({
      activeVehicles: 0,
      attachments: 0,
      totalRecords: 0,
      totalVehicles: 0,
    });
    expect(summary.warnings).toEqual([]);
  });

  it("counts local guest records and reports readiness warnings", async () => {
    const db = createMockDatabase({
      activeVehicles: 2,
      archivedVehicles: 1,
      attachments: 4,
      completedReminders: 1,
      maintenanceReminders: 3,
      odometerEntries: 5,
      repairRecords: 2,
      serviceRecords: 6,
    });
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const summary = await getGuestMigrationSummary();

    expect(summary.hasGuestData).toBe(true);
    expect(summary.counts).toMatchObject({
      activeVehicles: 2,
      archivedVehicles: 1,
      attachments: 4,
      completedReminders: 1,
      maintenanceReminders: 3,
      odometerEntries: 5,
      repairRecords: 2,
      serviceRecords: 6,
      totalRecords: 23,
      totalVehicles: 3,
    });
    expect(summary.warnings.map((warning) => warning.code)).toEqual([
      "account_required",
      "archived_vehicles_present",
      "attachments_require_upload",
    ]);
  });

  it("does not mutate local guest records when summarizing data", async () => {
    const db = createMockDatabase({ activeVehicles: 1 });
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    await getGuestMigrationSummary("user_1");

    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it("builds totals from supplied counts without reading storage", () => {
    const summary = buildGuestMigrationSummary({
      accountId: "user_1",
      counts: {
        activeVehicles: 1,
        archivedVehicles: 1,
        attachments: 0,
        completedReminders: 0,
        maintenanceReminders: 1,
        odometerEntries: 1,
        repairRecords: 1,
        serviceRecords: 1,
      },
    });

    expect(summary.counts.totalVehicles).toBe(2);
    expect(summary.counts.totalRecords).toBe(6);
    expect(summary.warnings.map((warning) => warning.code)).toEqual([
      "archived_vehicles_present",
    ]);
  });
});

describe("guest migration status storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an initial not-started migration run for an account", async () => {
    const db = createMockDatabase();
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const run = await getOrCreateInitialMigrationRun("user_1");

    expect(run).toMatchObject({
      account_id: "user_1",
      completed_at: null,
      error_message: null,
      id: "migration_run_test_id",
      status: "not_started",
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO migration_runs"),
      expect.arrayContaining([
        "migration_run_test_id",
        "user_1",
        expect.any(String),
        null,
        "not_started",
      ]),
    );
  });

  it("loads the latest migration run for one scope", async () => {
    const db = createMockDatabase();
    const scopedRun = createMigrationRunRow({
      id: "latest_service_run",
      migration_scope: "service_records",
    });
    (db.getFirstAsync as jest.Mock).mockResolvedValue(scopedRun);
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const run = await getLatestMigrationRunForAccountByScope({
      accountId: "user_1",
      scope: "service_records",
    });

    expect(run).toMatchObject({
      id: "latest_service_run",
      migration_scope: "service_records",
    });
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("migration_scope = ?"),
      "user_1",
      "service_records",
    );
  });

  it("returns null when a scope has no migration run", async () => {
    const db = createMockDatabase();
    (db.getFirstAsync as jest.Mock).mockResolvedValue(null);
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const run = await getLatestMigrationRunForAccountByScope({
      accountId: "user_1",
      scope: "record_attachments",
    });

    expect(run).toBeNull();
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("migration_scope = ?"),
      "user_1",
      "record_attachments",
    );
  });

  it("loads the latest migration run for each scope", async () => {
    const db = createMockDatabase();
    db.getAllAsync.mockResolvedValue([
      createMigrationRunRow({
        id: "new_vehicle_run",
        migration_scope: "vehicles",
        updated_at: "2026-05-02T00:03:00.000Z",
      }),
      createMigrationRunRow({
        id: "service_run",
        migration_scope: "service_records",
        updated_at: "2026-05-02T00:02:00.000Z",
      }),
      createMigrationRunRow({
        id: "old_vehicle_run",
        migration_scope: "vehicles",
        updated_at: "2026-05-02T00:01:00.000Z",
      }),
      {
        ...createMigrationRunRow({
          id: "unknown_scope_run",
        }),
        migration_scope: "legacy_scope",
      },
    ]);
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const runsByScope =
      await getLatestMigrationRunsByScopeForAccount("user_1");

    expect(runsByScope.vehicles?.id).toBe("new_vehicle_run");
    expect(runsByScope.service_records?.id).toBe("service_run");
    expect(runsByScope.repair_records).toBeNull();
    expect(runsByScope.record_attachments).toBeNull();
    expect(Object.keys(runsByScope)).toEqual([
      "full",
      "maintenance_reminders",
      "odometer_entries",
      "record_attachments",
      "repair_records",
      "service_records",
      "vehicles",
    ]);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("FROM migration_runs"),
      "user_1",
    );
  });

  it("upserts a vehicle migration mapping without duplicating local IDs", async () => {
    const db = createMockDatabase();
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const mapping = await upsertVehicleMigrationMapping({
      accountId: "user_1",
      cloudId: "cloud_vehicle_1",
      localId: "local_vehicle_1",
      runId: "run_1",
      status: "synced",
    });

    expect(mapping).toMatchObject({
      account_id: "user_1",
      cloud_id: "cloud_vehicle_1",
      entity_type: "vehicle",
      local_id: "local_vehicle_1",
      run_id: "run_1",
      status: "synced",
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(account_id, entity_type, local_id)"),
      expect.arrayContaining([
        "user_1",
        "vehicle",
        "local_vehicle_1",
        "cloud_vehicle_1",
        "synced",
      ]),
    );
  });

  it("counts only synced mappings with cloud IDs as migration-ready", () => {
    const count = countSyncedMigrationMappings([
      {
        cloud_id: "cloud_vehicle_1",
        status: "synced",
      },
      {
        cloud_id: null,
        status: "synced",
      },
      {
        cloud_id: "cloud_vehicle_failed",
        status: "failed",
      },
      {
        cloud_id: "cloud_vehicle_skipped",
        status: "skipped",
      },
      {
        cloud_id: "cloud_vehicle_running",
        status: "running",
      },
      {
        cloud_id: "cloud_vehicle_completed",
        status: "completed",
      },
      {
        cloud_id: "cloud_vehicle_completed_with_errors",
        status: "completed_with_errors",
      },
      {
        cloud_id: "   ",
        status: "synced",
      },
    ]);

    expect(count).toBe(1);
  });

  it("loads vehicle migration mappings for an account", async () => {
    const db = createMockDatabase();
    db.getAllAsync.mockResolvedValue([
      {
        account_id: "user_1",
        cloud_id: "cloud_vehicle_1",
        created_at: "2026-05-02T00:00:00.000Z",
        entity_type: "vehicle",
        error_message: null,
        id: "mapping_1",
        local_id: "local_vehicle_1",
        run_id: "run_1",
        status: "synced",
        updated_at: "2026-05-02T00:00:00.000Z",
      },
    ]);
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const mappings = await getVehicleMigrationMappings("user_1");

    expect(mappings).toHaveLength(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("entity_type = 'vehicle'"),
      "user_1",
    );
  });

  it("upserts and loads service record migration mappings", async () => {
    const db = createMockDatabase();
    db.getAllAsync.mockResolvedValue([
      {
        account_id: "user_1",
        cloud_id: "cloud_service_1",
        created_at: "2026-05-02T00:00:00.000Z",
        entity_type: "service_record",
        error_message: null,
        id: "mapping_1",
        local_id: "local_service_1",
        run_id: "run_1",
        status: "synced",
        updated_at: "2026-05-02T00:00:00.000Z",
      },
    ]);
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const mapping = await upsertServiceRecordMigrationMapping({
      accountId: "user_1",
      cloudId: "cloud_service_1",
      localId: "local_service_1",
      runId: "run_1",
      status: "synced",
    });
    const mappings = await getServiceRecordMigrationMappings("user_1");

    expect(mapping).toMatchObject({
      account_id: "user_1",
      cloud_id: "cloud_service_1",
      entity_type: "service_record",
      local_id: "local_service_1",
      status: "synced",
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(account_id, entity_type, local_id)"),
      expect.arrayContaining([
        "user_1",
        "service_record",
        "local_service_1",
        "cloud_service_1",
        "synced",
      ]),
    );
    expect(mappings).toHaveLength(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("entity_type = 'service_record'"),
      "user_1",
    );
  });

  it("upserts and loads repair record migration mappings", async () => {
    const db = createMockDatabase();
    db.getAllAsync.mockResolvedValue([
      {
        account_id: "user_1",
        cloud_id: "cloud_repair_1",
        created_at: "2026-05-02T00:00:00.000Z",
        entity_type: "repair_record",
        error_message: null,
        id: "mapping_1",
        local_id: "local_repair_1",
        run_id: "run_1",
        status: "synced",
        updated_at: "2026-05-02T00:00:00.000Z",
      },
    ]);
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const mapping = await upsertRepairRecordMigrationMapping({
      accountId: "user_1",
      cloudId: "cloud_repair_1",
      localId: "local_repair_1",
      runId: "run_1",
      status: "synced",
    });
    const mappings = await getRepairRecordMigrationMappings("user_1");

    expect(mapping).toMatchObject({
      account_id: "user_1",
      cloud_id: "cloud_repair_1",
      entity_type: "repair_record",
      local_id: "local_repair_1",
      status: "synced",
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(account_id, entity_type, local_id)"),
      expect.arrayContaining([
        "user_1",
        "repair_record",
        "local_repair_1",
        "cloud_repair_1",
        "synced",
      ]),
    );
    expect(mappings).toHaveLength(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("entity_type = 'repair_record'"),
      "user_1",
    );
  });

  it("upserts and loads maintenance reminder migration mappings", async () => {
    const db = createMockDatabase();
    db.getAllAsync.mockResolvedValue([
      {
        account_id: "user_1",
        cloud_id: "cloud_reminder_1",
        created_at: "2026-05-02T00:00:00.000Z",
        entity_type: "maintenance_reminder",
        error_message: null,
        id: "mapping_1",
        local_id: "local_reminder_1",
        run_id: "run_1",
        status: "synced",
        updated_at: "2026-05-02T00:00:00.000Z",
      },
    ]);
    mockedGetGuestDatabase.mockResolvedValue(db as never);

    const mapping = await upsertMaintenanceReminderMigrationMapping({
      accountId: "user_1",
      cloudId: "cloud_reminder_1",
      localId: "local_reminder_1",
      runId: "run_1",
      status: "synced",
    });
    const mappings = await getMaintenanceReminderMigrationMappings("user_1");

    expect(mapping).toMatchObject({
      account_id: "user_1",
      cloud_id: "cloud_reminder_1",
      entity_type: "maintenance_reminder",
      local_id: "local_reminder_1",
      status: "synced",
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(account_id, entity_type, local_id)"),
      expect.arrayContaining([
        "user_1",
        "maintenance_reminder",
        "local_reminder_1",
        "cloud_reminder_1",
        "synced",
      ]),
    );
    expect(mappings).toHaveLength(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("entity_type = 'maintenance_reminder'"),
      "user_1",
    );
  });
});
