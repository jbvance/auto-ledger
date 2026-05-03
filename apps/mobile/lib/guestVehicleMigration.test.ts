import type { Vehicle } from "@autoledger/shared";

jest.mock("./supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("./guestMigration", () => ({
  createVehicleMigrationRun: jest.fn(),
  updateMigrationRunStatus: jest.fn(),
  upsertVehicleMigrationMapping: jest.fn(),
}));

jest.mock("./vehicles", () => ({
  listArchivedVehicles: jest.fn(),
  listVehicles: jest.fn(),
}));

import {
  migrateGuestVehicleToCloud,
  migrateGuestVehiclesToCloud,
} from "./guestVehicleMigration";
import {
  createVehicleMigrationRun,
  updateMigrationRunStatus,
  upsertVehicleMigrationMapping,
} from "./guestMigration";
import { supabase } from "./supabase";
import { listArchivedVehicles, listVehicles } from "./vehicles";

const mockFrom = jest.mocked((supabase as unknown as { from: jest.Mock }).from);
const mockedCreateVehicleMigrationRun = jest.mocked(createVehicleMigrationRun);
const mockedListArchivedVehicles = jest.mocked(listArchivedVehicles);
const mockedListVehicles = jest.mocked(listVehicles);
const mockedUpdateMigrationRunStatus = jest.mocked(updateMigrationRunStatus);
const mockedUpsertVehicleMigrationMapping = jest.mocked(
  upsertVehicleMigrationMapping,
);

const now = "2026-05-02T12:00:00.000Z";

const createVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  archived_at: null,
  color: "Blue",
  created_at: now,
  current_odometer: 42000,
  id: "local_vehicle_1",
  initial_odometer: 10000,
  license_plate: "ABC123",
  license_state: "TX",
  local_id: "guest_vehicle_1",
  make: "Toyota",
  model: "RAV4",
  nickname: "Family car",
  notes: "Local note",
  odometer_unit: "mi",
  purchase_date: "2025-01-01",
  purchase_odometer: 10000,
  sync_status: "local_only",
  trim: "XLE",
  updated_at: now,
  vehicle_type: "suv",
  vin: "12345678901234567",
  year: 2021,
  ...overrides,
});

const createCloudVehicleRow = (vehicle: Vehicle, id = "cloud_vehicle_1") => ({
  ...vehicle,
  id,
  sync_status: "synced",
  user_id: "user_1",
});

const createSelectBuilder = ({
  error = null,
  row = null,
}: {
  error?: { code?: string; message: string } | null;
  row?: ReturnType<typeof createCloudVehicleRow> | null;
}) => {
  type SelectBuilder = {
    eq: jest.MockedFunction<() => SelectBuilder>;
    maybeSingle: jest.MockedFunction<
      () => Promise<{
        data: ReturnType<typeof createCloudVehicleRow> | null;
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

type InsertBuilderError = { code?: string; message: string } | null;

const createInsertBuilder = ({
  error = null,
  row,
}: {
  error?: InsertBuilderError;
  row: ReturnType<typeof createCloudVehicleRow>;
}) => {
  type InsertBuilder = {
    insert: jest.MockedFunction<() => InsertBuilder>;
    select: jest.MockedFunction<() => InsertBuilder>;
    single: jest.MockedFunction<
      () => Promise<{
        data: ReturnType<typeof createCloudVehicleRow> | null;
        error: InsertBuilderError;
      }>
    >;
  };
  const builder = {} as InsertBuilder;

  builder.insert = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.single = jest.fn(async () => ({ data: error ? null : row, error }));

  return builder;
};

describe("guest vehicle migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateVehicleMigrationRun.mockResolvedValue({
      account_id: "user_1",
      completed_at: null,
      created_at: now,
      error_message: null,
      failed_odometer_entries: 0,
      failed_repair_records: 0,
      failed_service_records: 0,
      failed_vehicles: 0,
      id: "run_1",
      migrated_odometer_entries: 0,
      migrated_repair_records: 0,
      migrated_service_records: 0,
      migrated_vehicles: 0,
      migration_scope: "vehicles",
      skipped_odometer_entries: 0,
      skipped_odometer_entries_missing_vehicle_mapping: 0,
      skipped_repair_records: 0,
      skipped_repair_records_missing_vehicle_mapping: 0,
      skipped_service_records: 0,
      skipped_service_records_missing_vehicle_mapping: 0,
      skipped_vehicles: 0,
      started_at: now,
      status: "running",
      total_odometer_entries: 0,
      total_repair_records: 0,
      total_service_records: 0,
      total_vehicles: 0,
      updated_at: now,
    });
    mockedUpdateMigrationRunStatus.mockResolvedValue(undefined);
    mockedUpsertVehicleMigrationMapping.mockResolvedValue({
      account_id: "user_1",
      cloud_id: "cloud_vehicle_1",
      created_at: now,
      entity_type: "vehicle",
      error_message: null,
      id: "mapping_1",
      local_id: "guest_vehicle_1",
      run_id: "run_1",
      status: "synced",
      updated_at: now,
    });
  });

  it("preserves the local_id and archived_at when inserting a local vehicle", async () => {
    const vehicle = createVehicle({
      archived_at: "2026-04-01T00:00:00.000Z",
      id: "local_primary_key",
      local_id: "stable_guest_local_id",
    });
    const selectBuilder = createSelectBuilder({ row: null });
    const insertBuilder = createInsertBuilder({
      row: createCloudVehicleRow(vehicle, "cloud_vehicle_1"),
    });
    mockFrom
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(insertBuilder);

    const result = await migrateGuestVehicleToCloud(vehicle, "user_1", "run_1");

    expect(result).toMatchObject({
      cloudId: "cloud_vehicle_1",
      localId: "stable_guest_local_id",
      status: "migrated",
    });
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        archived_at: "2026-04-01T00:00:00.000Z",
        created_at: vehicle.created_at,
        local_id: "stable_guest_local_id",
        updated_at: vehicle.updated_at,
        user_id: "user_1",
      }),
    );
    expect(mockedUpsertVehicleMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "user_1",
        cloudId: "cloud_vehicle_1",
        localId: "stable_guest_local_id",
        runId: "run_1",
        status: "synced",
      }),
    );
  });

  it("reuses an existing cloud vehicle with the same user_id and local_id", async () => {
    const vehicle = createVehicle();
    const selectBuilder = createSelectBuilder({
      row: createCloudVehicleRow(vehicle, "cloud_vehicle_existing"),
    });
    mockFrom.mockReturnValueOnce(selectBuilder);

    const result = await migrateGuestVehicleToCloud(vehicle, "user_1", "run_1");

    expect(result).toMatchObject({
      cloudId: "cloud_vehicle_existing",
      status: "already_migrated",
    });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockedUpsertVehicleMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "cloud_vehicle_existing",
        localId: vehicle.local_id,
        status: "synced",
      }),
    );
  });

  it("collects active and archived vehicles without reading child records", async () => {
    const activeVehicle = createVehicle({ local_id: "active_vehicle" });
    const archivedVehicle = createVehicle({
      archived_at: "2026-04-01T00:00:00.000Z",
      id: "archived_local_vehicle",
      local_id: "archived_vehicle",
    });
    mockedListVehicles.mockResolvedValue([activeVehicle]);
    mockedListArchivedVehicles.mockResolvedValue([archivedVehicle]);
    mockFrom
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(
        createInsertBuilder({
          row: createCloudVehicleRow(activeVehicle, "cloud_active"),
        }),
      )
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(
        createInsertBuilder({
          row: createCloudVehicleRow(archivedVehicle, "cloud_archived"),
        }),
      );

    const result = await migrateGuestVehiclesToCloud("user_1");

    expect(mockedListVehicles).toHaveBeenCalledTimes(1);
    expect(mockedListArchivedVehicles).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 2,
      skippedCount: 0,
      totalVehicles: 2,
    });
    expect(mockedCreateVehicleMigrationRun).toHaveBeenCalledWith({
      accountId: "user_1",
      totalVehicles: 2,
    });
  });

  it("continues after one vehicle fails and records per-vehicle failure", async () => {
    const failingVehicle = createVehicle({ local_id: "failing_vehicle" });
    const successfulVehicle = createVehicle({
      id: "local_vehicle_2",
      local_id: "successful_vehicle",
    });
    mockedListVehicles.mockResolvedValue([failingVehicle, successfulVehicle]);
    mockedListArchivedVehicles.mockResolvedValue([]);
    mockFrom
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(
        createInsertBuilder({
          error: { message: "network unavailable" },
          row: createCloudVehicleRow(failingVehicle, "cloud_failed"),
        }),
      )
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(
        createInsertBuilder({
          row: createCloudVehicleRow(successfulVehicle, "cloud_success"),
        }),
      );

    const result = await migrateGuestVehiclesToCloud("user_1");

    expect(result).toMatchObject({
      failedCount: 1,
      migratedCount: 1,
      skippedCount: 0,
      totalVehicles: 2,
    });
    expect(mockedUpsertVehicleMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: null,
        localId: "failing_vehicle",
        status: "failed",
      }),
    );
    expect(mockedUpsertVehicleMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "cloud_success",
        localId: "successful_vehicle",
        status: "synced",
      }),
    );
    expect(mockedUpdateMigrationRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "completed_with_errors",
      }),
    );
  });
});
