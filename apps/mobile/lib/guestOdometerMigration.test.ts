import type { OdometerEntry } from "@autoledger/shared";

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
  recalculateCloudVehicleOdometer: jest.fn(),
}));

jest.mock("./guestMigration", () => ({
  createOdometerMigrationRun: jest.fn(),
  getOdometerMigrationMappings: jest.fn(),
  getVehicleMigrationMappings: jest.fn(),
  updateOdometerMigrationRunStatus: jest.fn(),
  upsertOdometerMigrationMapping: jest.fn(),
}));

jest.mock("./odometerEntries", () => ({
  listAllOdometerEntries: jest.fn(),
}));

jest.mock("./vehicles", () => ({
  getVehicle: jest.fn(),
}));

import { recalculateCloudVehicleOdometer } from "./cloudVehicleOdometer";
import {
  createOdometerMigrationRun,
  getVehicleMigrationMappings,
  updateOdometerMigrationRunStatus,
  upsertOdometerMigrationMapping,
} from "./guestMigration";
import {
  migrateGuestOdometerEntriesToCloud,
  migrateGuestOdometerEntryToCloud,
} from "./guestOdometerMigration";
import { listAllOdometerEntries } from "./odometerEntries";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

const mockFrom = jest.mocked((supabase as unknown as { from: jest.Mock }).from);
const mockedCreateOdometerMigrationRun = jest.mocked(
  createOdometerMigrationRun,
);
const mockedGetVehicle = jest.mocked(getVehicle);
const mockedGetVehicleMigrationMappings = jest.mocked(
  getVehicleMigrationMappings,
);
const mockedListAllOdometerEntries = jest.mocked(listAllOdometerEntries);
const mockedRecalculateCloudVehicleOdometer = jest.mocked(
  recalculateCloudVehicleOdometer,
);
const mockedUpdateOdometerMigrationRunStatus = jest.mocked(
  updateOdometerMigrationRunStatus,
);
const mockedUpsertOdometerMigrationMapping = jest.mocked(
  upsertOdometerMigrationMapping,
);

const now = "2026-05-02T12:00:00.000Z";

const entry: OdometerEntry = {
  created_at: now,
  id: "local_odo_pk_1",
  local_id: "guest_odo_1",
  notes: "Trip reading",
  odometer_unit: "mi",
  reading: 42000,
  reading_date: "2026-05-01",
  source_type: "manual",
  sync_status: "local_only",
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

const odometerRun = {
  account_id: "user_1",
  completed_at: null,
  created_at: now,
  error_message: null,
  failed_odometer_entries: 0,
  failed_repair_records: 0,
  failed_service_records: 0,
  failed_vehicles: 0,
  id: "run_odo_1",
  migrated_odometer_entries: 0,
  migrated_repair_records: 0,
  migrated_service_records: 0,
  migrated_vehicles: 0,
  migration_scope: "odometer_entries" as const,
  skipped_odometer_entries: 0,
  skipped_odometer_entries_missing_vehicle_mapping: 0,
  skipped_repair_records: 0,
  skipped_repair_records_missing_vehicle_mapping: 0,
  skipped_service_records: 0,
  skipped_service_records_missing_vehicle_mapping: 0,
  skipped_vehicles: 0,
  started_at: now,
  status: "running" as const,
  total_odometer_entries: 1,
  total_repair_records: 0,
  total_service_records: 0,
  total_vehicles: 0,
  updated_at: now,
};

const cloudEntryRow = {
  ...entry,
  id: "cloud_odo_1",
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
  row = cloudEntryRow,
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

describe("guest odometer migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateOdometerMigrationRun.mockResolvedValue(odometerRun);
    mockedGetVehicle.mockResolvedValue({
      archived_at: null,
      color: null,
      created_at: now,
      current_odometer: 42000,
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
    mockedListAllOdometerEntries.mockResolvedValue([entry]);
    mockedRecalculateCloudVehicleOdometer.mockResolvedValue(undefined);
    mockedUpdateOdometerMigrationRunStatus.mockResolvedValue(undefined);
    mockedUpsertOdometerMigrationMapping.mockResolvedValue({
      account_id: "user_1",
      cloud_id: "cloud_odo_1",
      created_at: now,
      entity_type: "odometer_entry",
      error_message: null,
      id: "odo_mapping_1",
      local_id: entry.local_id,
      run_id: "run_odo_1",
      status: "synced",
      updated_at: now,
    });
  });

  it("preserves local_id and uses the mapped cloud vehicle when inserting", async () => {
    const vehicleBuilder = createSelectBuilder({
      row: { id: "cloud_vehicle_1", odometer_unit: "mi" },
    });
    const existingEntryBuilder = createSelectBuilder({ row: null });
    const insertBuilder = createInsertBuilder({});
    mockFrom
      .mockReturnValueOnce(vehicleBuilder)
      .mockReturnValueOnce(existingEntryBuilder)
      .mockReturnValueOnce(insertBuilder);

    const result = await migrateGuestOdometerEntryToCloud(
      entry,
      "user_1",
      vehicleMapping,
      "run_odo_1",
    );

    expect(result).toMatchObject({
      cloudId: "cloud_odo_1",
      cloudVehicleId: "cloud_vehicle_1",
      localId: "guest_odo_1",
      status: "migrated",
    });
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        created_at: entry.created_at,
        local_id: entry.local_id,
        reading: entry.reading,
        updated_at: entry.updated_at,
        user_id: "user_1",
        vehicle_id: "cloud_vehicle_1",
      }),
    );
    expect(mockedUpsertOdometerMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "user_1",
        cloudId: "cloud_odo_1",
        localId: "guest_odo_1",
        runId: "run_odo_1",
        status: "synced",
      }),
    );
  });

  it("skips entries safely when the vehicle mapping is missing", async () => {
    const result = await migrateGuestOdometerEntryToCloud(
      entry,
      "user_1",
      null,
      "run_odo_1",
    );

    expect(result).toMatchObject({
      cloudId: null,
      status: "skipped_missing_vehicle_mapping",
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockedUpsertOdometerMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: null,
        localId: "guest_odo_1",
        status: "skipped",
      }),
    );
  });

  it("reuses an existing cloud row and repairs the mapping on rerun", async () => {
    mockFrom
      .mockReturnValueOnce(
        createSelectBuilder({
          row: { id: "cloud_vehicle_1", odometer_unit: "mi" },
        }),
      )
      .mockReturnValueOnce(createSelectBuilder({ row: cloudEntryRow }));

    const result = await migrateGuestOdometerEntryToCloud(
      entry,
      "user_1",
      vehicleMapping,
      "run_odo_1",
    );

    expect(result).toMatchObject({
      cloudId: "cloud_odo_1",
      status: "already_migrated",
    });
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockedUpsertOdometerMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "cloud_odo_1",
        localId: "guest_odo_1",
        status: "synced",
      }),
    );
  });

  it("migrates only odometer entries, keeps local data untouched, and recalculates affected cloud vehicles", async () => {
    mockFrom
      .mockReturnValueOnce(
        createSelectBuilder({
          row: { id: "cloud_vehicle_1", odometer_unit: "mi" },
        }),
      )
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(createInsertBuilder({}));

    const result = await migrateGuestOdometerEntriesToCloud("user_1");

    expect(mockedListAllOdometerEntries).toHaveBeenCalledTimes(1);
    expect(mockedGetVehicleMigrationMappings).toHaveBeenCalledWith("user_1");
    expect(mockedGetVehicle).toHaveBeenCalledWith("local_vehicle_1", {
      includeArchived: true,
    });
    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 1,
      skippedCount: 0,
      skippedMissingVehicleMappingCount: 0,
      totalOdometerEntries: 1,
    });
    expect(mockedRecalculateCloudVehicleOdometer).toHaveBeenCalledWith(
      "cloud_vehicle_1",
      "user_1",
      { includeArchived: true, preserveCurrent: true },
    );
    expect(mockedUpdateOdometerMigrationRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "completed",
      }),
    );
  });

  it("marks the run failed when every odometer entry is skipped for missing vehicle mappings", async () => {
    mockedGetVehicleMigrationMappings.mockResolvedValue([]);

    const result = await migrateGuestOdometerEntriesToCloud("user_1");

    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 0,
      skippedMissingVehicleMappingCount: 1,
      totalOdometerEntries: 1,
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockedRecalculateCloudVehicleOdometer).not.toHaveBeenCalled();
    expect(mockedUpdateOdometerMigrationRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        counts: expect.objectContaining({
          skippedOdometerEntriesMissingVehicleMapping: 1,
        }),
        errorMessage: expect.stringContaining(
          "skipped because vehicle migration mapping was missing",
        ),
        status: "failed",
      }),
    );
    expect(result.run.status).toBe("failed");
  });

  it("marks the run completed with errors when only some entries are skipped for missing vehicle mappings", async () => {
    const skippedEntry: OdometerEntry = {
      ...entry,
      id: "local_odo_pk_2",
      local_id: "guest_odo_2",
      reading: 42500,
      vehicle_id: "local_vehicle_2",
    };

    mockedListAllOdometerEntries.mockResolvedValue([entry, skippedEntry]);
    mockedGetVehicle.mockImplementation(async (vehicleId: string) => ({
      archived_at: null,
      color: null,
      created_at: now,
      current_odometer: 42000,
      id: vehicleId,
      initial_odometer: 10000,
      license_plate: null,
      license_state: null,
      local_id: vehicleId,
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
    }));
    mockFrom
      .mockReturnValueOnce(
        createSelectBuilder({
          row: { id: "cloud_vehicle_1", odometer_unit: "mi" },
        }),
      )
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(createInsertBuilder({}));

    const result = await migrateGuestOdometerEntriesToCloud("user_1");

    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 1,
      skippedMissingVehicleMappingCount: 1,
      totalOdometerEntries: 2,
    });
    expect(mockedRecalculateCloudVehicleOdometer).toHaveBeenCalledTimes(1);
    expect(mockedUpdateOdometerMigrationRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        counts: expect.objectContaining({
          migratedOdometerEntries: 1,
          skippedOdometerEntriesMissingVehicleMapping: 1,
        }),
        errorMessage: expect.stringContaining(
          "skipped because vehicle migration mapping was missing",
        ),
        status: "completed_with_errors",
      }),
    );
    expect(result.run.status).toBe("completed_with_errors");
  });
});
