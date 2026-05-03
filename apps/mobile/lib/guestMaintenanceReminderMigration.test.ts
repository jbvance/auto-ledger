import {
  getMaintenanceReminderStatus,
  type MaintenanceReminder,
} from "@autoledger/shared";

jest.mock("./supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { id: "user_1" } },
        error: null,
      })),
    },
    from: jest.fn(),
  },
}));

jest.mock("./cloudVehicleOdometer", () => ({
  getCloudVehicleForOdometer: jest.fn(),
}));

jest.mock("./guestMigration", () => ({
  createMaintenanceReminderMigrationRun: jest.fn(),
  getMaintenanceReminderMigrationMappings: jest.fn(),
  getVehicleMigrationMappings: jest.fn(),
  updateMaintenanceReminderMigrationRunStatus: jest.fn(),
  upsertMaintenanceReminderMigrationMapping: jest.fn(),
}));

jest.mock("./maintenanceReminders", () => ({
  listAllMaintenanceReminders: jest.fn(),
}));

jest.mock("./vehicles", () => ({
  getVehicle: jest.fn(),
}));

import { getCloudVehicleForOdometer } from "./cloudVehicleOdometer";
import {
  createMaintenanceReminderMigrationRun,
  getVehicleMigrationMappings,
  updateMaintenanceReminderMigrationRunStatus,
  upsertMaintenanceReminderMigrationMapping,
} from "./guestMigration";
import {
  migrateGuestMaintenanceRemindersToCloud,
  migrateGuestMaintenanceReminderToCloud,
} from "./guestMaintenanceReminderMigration";
import { listAllMaintenanceReminders } from "./maintenanceReminders";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

const mockFrom = jest.mocked((supabase as unknown as { from: jest.Mock }).from);
const mockedCreateMaintenanceReminderMigrationRun = jest.mocked(
  createMaintenanceReminderMigrationRun,
);
const mockedGetCloudVehicleForOdometer = jest.mocked(
  getCloudVehicleForOdometer,
);
const mockedGetVehicle = jest.mocked(getVehicle);
const mockedGetVehicleMigrationMappings = jest.mocked(
  getVehicleMigrationMappings,
);
const mockedListAllMaintenanceReminders = jest.mocked(
  listAllMaintenanceReminders,
);
const mockedUpdateMaintenanceReminderMigrationRunStatus = jest.mocked(
  updateMaintenanceReminderMigrationRunStatus,
);
const mockedUpsertMaintenanceReminderMigrationMapping = jest.mocked(
  upsertMaintenanceReminderMigrationMapping,
);

const now = "2026-05-02T12:00:00.000Z";

const reminder: MaintenanceReminder = {
  category: "oil_change",
  completed_at: "2026-04-20T10:00:00.000Z",
  created_at: now,
  due_date: "2026-06-01",
  due_odometer: 80000,
  id: "local_reminder_pk_1",
  is_completed: true,
  last_triggered_at: "2026-04-15T10:00:00.000Z",
  local_id: "guest_reminder_1",
  notes: "Created while signed out",
  reminder_type: "date_or_mileage",
  repeat_interval_miles: 5000,
  repeat_interval_months: 6,
  scheduled_notification_id: "local_notification_1",
  sync_status: "local_only",
  title: "Oil change",
  updated_at: now,
  vehicle_id: "local_vehicle_1",
};

const vehicleMapping = {
  account_id: "user_1",
  cloud_id: "cloud_vehicle_1",
  created_at: now,
  entity_type: "vehicle" as const,
  error_message: null,
  id: "vehicle_mapping_1",
  local_id: "local_vehicle_1",
  run_id: "vehicle_run_1",
  status: "synced" as const,
  updated_at: now,
};

const reminderRun = {
  account_id: "user_1",
  completed_at: null,
  created_at: now,
  error_message: null,
  failed_maintenance_reminders: 0,
  failed_odometer_entries: 0,
  failed_repair_records: 0,
  failed_service_records: 0,
  failed_vehicles: 0,
  id: "run_reminder_1",
  migrated_maintenance_reminders: 0,
  migrated_odometer_entries: 0,
  migrated_repair_records: 0,
  migrated_service_records: 0,
  migrated_vehicles: 0,
  migration_scope: "maintenance_reminders" as const,
  skipped_maintenance_reminders: 0,
  skipped_maintenance_reminders_missing_vehicle_mapping: 0,
  skipped_odometer_entries: 0,
  skipped_odometer_entries_missing_vehicle_mapping: 0,
  skipped_repair_records: 0,
  skipped_repair_records_missing_vehicle_mapping: 0,
  skipped_service_records: 0,
  skipped_service_records_missing_vehicle_mapping: 0,
  skipped_vehicles: 0,
  started_at: now,
  status: "running" as const,
  total_maintenance_reminders: 1,
  total_odometer_entries: 0,
  total_repair_records: 0,
  total_service_records: 0,
  total_vehicles: 0,
  updated_at: now,
};

const cloudReminderRow = {
  ...reminder,
  id: "cloud_reminder_1",
  scheduled_notification_id: null,
  sync_status: "synced",
  user_id: "user_1",
  vehicle_id: "cloud_vehicle_1",
};

const createSelectBuilder = ({
  error = null,
  row = null,
}: {
  error?: { code?: string; message: string } | null;
  row?: Record<string, unknown> | null;
}) => {
  type SelectBuilder = {
    eq: jest.MockedFunction<() => SelectBuilder>;
    maybeSingle: jest.MockedFunction<
      () => Promise<{
        data: Record<string, unknown> | null;
        error: typeof error;
      }>
    >;
    select: jest.MockedFunction<() => SelectBuilder>;
  };
  const builder = {} as SelectBuilder;

  builder.eq = jest.fn(() => builder);
  builder.maybeSingle = jest.fn(async () => ({ data: row, error }));
  builder.select = jest.fn(() => builder);

  return builder;
};

const createInsertBuilder = ({
  error = null,
  row = cloudReminderRow,
}: {
  error?: { code?: string; message: string } | null;
  row?: Record<string, unknown>;
}) => {
  type InsertBuilder = {
    insert: jest.MockedFunction<() => InsertBuilder>;
    select: jest.MockedFunction<() => InsertBuilder>;
    single: jest.MockedFunction<
      () => Promise<{
        data: Record<string, unknown> | null;
        error: typeof error;
      }>
    >;
  };
  const builder = {} as InsertBuilder;

  builder.insert = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.single = jest.fn(async () => ({ data: error ? null : row, error }));

  return builder;
};

describe("guest maintenance reminder migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateMaintenanceReminderMigrationRun.mockResolvedValue(reminderRun);
    mockedGetCloudVehicleForOdometer.mockResolvedValue({
      current_odometer: 76000,
      id: "cloud_vehicle_1",
      initial_odometer: 10000,
      odometer_unit: "mi",
      purchase_odometer: null,
    });
    mockedGetVehicle.mockResolvedValue({
      archived_at: null,
      color: null,
      created_at: now,
      current_odometer: 76000,
      id: "local_vehicle_1",
      initial_odometer: 10000,
      license_plate: null,
      license_state: null,
      local_id: "local_vehicle_1",
      make: "Toyota",
      model: "RAV4",
      nickname: "Family car",
      notes: null,
      odometer_unit: "mi",
      purchase_date: null,
      purchase_odometer: null,
      sync_status: "local_only",
      trim: null,
      updated_at: now,
      vehicle_type: "suv",
      vin: null,
      year: 2021,
    });
    mockedGetVehicleMigrationMappings.mockResolvedValue([vehicleMapping]);
    mockedListAllMaintenanceReminders.mockResolvedValue([reminder]);
    mockedUpdateMaintenanceReminderMigrationRunStatus.mockResolvedValue(
      undefined,
    );
    mockedUpsertMaintenanceReminderMigrationMapping.mockResolvedValue({
      account_id: "user_1",
      cloud_id: "cloud_reminder_1",
      created_at: now,
      entity_type: "maintenance_reminder",
      error_message: null,
      id: "reminder_mapping_1",
      local_id: reminder.local_id,
      run_id: "run_reminder_1",
      status: "synced",
      updated_at: now,
    });
  });

  it("preserves local_id and maps reminder fields to the mapped cloud vehicle", async () => {
    const existingReminderBuilder = createSelectBuilder({ row: null });
    const insertBuilder = createInsertBuilder({});
    mockFrom
      .mockReturnValueOnce(existingReminderBuilder)
      .mockReturnValueOnce(insertBuilder);

    const result = await migrateGuestMaintenanceReminderToCloud(
      reminder,
      "user_1",
      vehicleMapping,
      "run_reminder_1",
    );

    expect(result).toMatchObject({
      cloudId: "cloud_reminder_1",
      cloudVehicleId: "cloud_vehicle_1",
      localId: "guest_reminder_1",
      status: "migrated",
    });
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_at: reminder.completed_at,
        due_date: "2026-06-01",
        due_odometer: 80000,
        is_completed: true,
        last_triggered_at: reminder.last_triggered_at,
        local_id: reminder.local_id,
        reminder_type: "date_or_mileage",
        repeat_interval_miles: 5000,
        repeat_interval_months: 6,
        scheduled_notification_id: null,
        user_id: "user_1",
        vehicle_id: "cloud_vehicle_1",
      }),
    );
    expect(mockedUpsertMaintenanceReminderMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "user_1",
        cloudId: "cloud_reminder_1",
        localId: "guest_reminder_1",
        runId: "run_reminder_1",
        status: "synced",
      }),
    );
    expect(
      getMaintenanceReminderStatus({
        currentOdometer: 76000,
        reminder: cloudReminderRow,
      }),
    ).toBe("completed");
  });

  it("skips reminders safely when the vehicle mapping is missing", async () => {
    const result = await migrateGuestMaintenanceReminderToCloud(
      reminder,
      "user_1",
      null,
      "run_reminder_1",
    );

    expect(result).toMatchObject({
      cloudId: null,
      status: "skipped_missing_vehicle_mapping",
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockedUpsertMaintenanceReminderMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: null,
        localId: "guest_reminder_1",
        status: "skipped",
      }),
    );
  });

  it("reuses an existing cloud row and repairs the mapping on rerun", async () => {
    mockFrom.mockReturnValueOnce(
      createSelectBuilder({ row: cloudReminderRow }),
    );

    const result = await migrateGuestMaintenanceReminderToCloud(
      reminder,
      "user_1",
      vehicleMapping,
      "run_reminder_1",
    );

    expect(result).toMatchObject({
      cloudId: "cloud_reminder_1",
      status: "already_migrated",
    });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockedUpsertMaintenanceReminderMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "cloud_reminder_1",
        localId: "guest_reminder_1",
        status: "synced",
      }),
    );
  });

  it("migrates only reminders and keeps local data untouched", async () => {
    mockFrom
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(createInsertBuilder({}));

    const result = await migrateGuestMaintenanceRemindersToCloud("user_1");

    expect(mockedListAllMaintenanceReminders).toHaveBeenCalledTimes(1);
    expect(mockedGetVehicleMigrationMappings).toHaveBeenCalledWith("user_1");
    expect(mockedGetVehicle).toHaveBeenCalledWith("local_vehicle_1", {
      includeArchived: true,
    });
    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 1,
      skippedCount: 0,
      skippedMissingVehicleMappingCount: 0,
      totalMaintenanceReminders: 1,
    });
    expect(mockedUpdateMaintenanceReminderMigrationRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "completed",
      }),
    );
  });

  it("marks the run failed when every reminder is skipped for missing vehicle mappings", async () => {
    mockedGetVehicleMigrationMappings.mockResolvedValue([]);

    const result = await migrateGuestMaintenanceRemindersToCloud("user_1");

    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 0,
      skippedMissingVehicleMappingCount: 1,
      totalMaintenanceReminders: 1,
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockedUpdateMaintenanceReminderMigrationRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });
});
