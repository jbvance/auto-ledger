import type { RepairRecord } from "@autoledger/shared";

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
  recalculateCloudVehicleOdometer: jest.fn(),
}));

jest.mock("./guestMigration", () => ({
  createRepairRecordMigrationRun: jest.fn(),
  getRepairRecordMigrationMappings: jest.fn(),
  getVehicleMigrationMappings: jest.fn(),
  updateRepairRecordMigrationRunStatus: jest.fn(),
  upsertRepairRecordMigrationMapping: jest.fn(),
}));

jest.mock("./repairRecords", () => ({
  listAllRepairRecords: jest.fn(),
}));

jest.mock("./vehicles", () => ({
  getVehicle: jest.fn(),
}));

import {
  getCloudVehicleForOdometer,
  recalculateCloudVehicleOdometer,
} from "./cloudVehicleOdometer";
import {
  createRepairRecordMigrationRun,
  getVehicleMigrationMappings,
  updateRepairRecordMigrationRunStatus,
  upsertRepairRecordMigrationMapping,
} from "./guestMigration";
import {
  migrateGuestRepairRecordsToCloud,
  migrateGuestRepairRecordToCloud,
} from "./guestRepairRecordMigration";
import { listAllRepairRecords } from "./repairRecords";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

const mockFrom = jest.mocked((supabase as unknown as { from: jest.Mock }).from);
const mockedCreateRepairRecordMigrationRun = jest.mocked(
  createRepairRecordMigrationRun,
);
const mockedGetCloudVehicleForOdometer = jest.mocked(
  getCloudVehicleForOdometer,
);
const mockedGetVehicle = jest.mocked(getVehicle);
const mockedGetVehicleMigrationMappings = jest.mocked(
  getVehicleMigrationMappings,
);
const mockedListAllRepairRecords = jest.mocked(listAllRepairRecords);
const mockedRecalculateCloudVehicleOdometer = jest.mocked(
  recalculateCloudVehicleOdometer,
);
const mockedUpdateRepairRecordMigrationRunStatus = jest.mocked(
  updateRepairRecordMigrationRunStatus,
);
const mockedUpsertRepairRecordMigrationMapping = jest.mocked(
  upsertRepairRecordMigrationMapping,
);

const now = "2026-05-02T12:00:00.000Z";

const repairRecord: RepairRecord = {
  category: "electrical",
  cost_amount: 489.75,
  cost_currency: "USD",
  created_at: now,
  description: "Replaced alternator and tested battery",
  id: "local_repair_pk_1",
  local_id: "guest_repair_1",
  notes: "Warranty paperwork attached locally",
  odometer_reading: 73500,
  repair_date: "2026-04-30",
  sync_status: "local_only",
  title: "Alternator replacement",
  updated_at: now,
  vehicle_id: "local_vehicle_1",
  vendor_name: "Neighborhood Auto",
  warranty_until_date: "2027-04-30",
  warranty_until_odometer: 85500,
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

const repairRun = {
  account_id: "user_1",
  completed_at: null,
  created_at: now,
  error_message: null,
  failed_odometer_entries: 0,
  failed_repair_records: 0,
  failed_service_records: 0,
  failed_vehicles: 0,
  id: "run_repair_1",
  migrated_odometer_entries: 0,
  migrated_repair_records: 0,
  migrated_service_records: 0,
  migrated_vehicles: 0,
  migration_scope: "repair_records",
  skipped_odometer_entries: 0,
  skipped_odometer_entries_missing_vehicle_mapping: 0,
  skipped_repair_records: 0,
  skipped_repair_records_missing_vehicle_mapping: 0,
  skipped_service_records: 0,
  skipped_service_records_missing_vehicle_mapping: 0,
  skipped_vehicles: 0,
  started_at: now,
  status: "running" as const,
  total_odometer_entries: 0,
  total_repair_records: 1,
  total_service_records: 0,
  total_vehicles: 0,
  updated_at: now,
};

const cloudRepairRecordRow = {
  ...repairRecord,
  id: "cloud_repair_1",
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
  row = cloudRepairRecordRow,
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

describe("guest repair record migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateRepairRecordMigrationRun.mockResolvedValue(repairRun);
    mockedGetCloudVehicleForOdometer.mockResolvedValue({
      current_odometer: 72000,
      id: "cloud_vehicle_1",
      initial_odometer: 10000,
      odometer_unit: "mi",
      purchase_odometer: null,
    });
    mockedGetVehicle.mockResolvedValue({
      archived_at: null,
      color: null,
      created_at: now,
      current_odometer: 73500,
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
    mockedListAllRepairRecords.mockResolvedValue([repairRecord]);
    mockedRecalculateCloudVehicleOdometer.mockResolvedValue(undefined);
    mockedUpdateRepairRecordMigrationRunStatus.mockResolvedValue(undefined);
    mockedUpsertRepairRecordMigrationMapping.mockResolvedValue({
      account_id: "user_1",
      cloud_id: "cloud_repair_1",
      created_at: now,
      entity_type: "repair_record",
      error_message: null,
      id: "repair_mapping_1",
      local_id: repairRecord.local_id,
      run_id: "run_repair_1",
      status: "synced",
      updated_at: now,
    });
  });

  it("preserves local_id and maps key repair fields to the mapped cloud vehicle", async () => {
    const existingRecordBuilder = createSelectBuilder({ row: null });
    const insertBuilder = createInsertBuilder({});
    mockFrom
      .mockReturnValueOnce(existingRecordBuilder)
      .mockReturnValueOnce(insertBuilder);

    const result = await migrateGuestRepairRecordToCloud(
      repairRecord,
      "user_1",
      vehicleMapping,
      "run_repair_1",
    );

    expect(result).toMatchObject({
      cloudId: "cloud_repair_1",
      cloudVehicleId: "cloud_vehicle_1",
      localId: "guest_repair_1",
      status: "migrated",
    });
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "electrical",
        cost_amount: 489.75,
        cost_currency: "USD",
        created_at: repairRecord.created_at,
        local_id: repairRecord.local_id,
        odometer_reading: 73500,
        repair_date: "2026-04-30",
        updated_at: repairRecord.updated_at,
        user_id: "user_1",
        vehicle_id: "cloud_vehicle_1",
        vendor_id: null,
        vendor_name: "Neighborhood Auto",
        warranty_until_date: "2027-04-30",
        warranty_until_odometer: 85500,
      }),
    );
    expect(mockedUpsertRepairRecordMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "user_1",
        cloudId: "cloud_repair_1",
        localId: "guest_repair_1",
        runId: "run_repair_1",
        status: "synced",
      }),
    );
  });

  it("skips records safely when the vehicle mapping is missing", async () => {
    const result = await migrateGuestRepairRecordToCloud(
      repairRecord,
      "user_1",
      null,
      "run_repair_1",
    );

    expect(result).toMatchObject({
      cloudId: null,
      status: "skipped_missing_vehicle_mapping",
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockedUpsertRepairRecordMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: null,
        localId: "guest_repair_1",
        status: "skipped",
      }),
    );
  });

  it("reuses an existing cloud row and repairs the mapping on rerun", async () => {
    mockFrom.mockReturnValueOnce(
      createSelectBuilder({ row: cloudRepairRecordRow }),
    );

    const result = await migrateGuestRepairRecordToCloud(
      repairRecord,
      "user_1",
      vehicleMapping,
      "run_repair_1",
    );

    expect(result).toMatchObject({
      cloudId: "cloud_repair_1",
      status: "already_migrated",
    });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockedUpsertRepairRecordMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "cloud_repair_1",
        localId: "guest_repair_1",
        status: "synced",
      }),
    );
  });

  it("migrates only repair records, keeps local data untouched, and recalculates affected cloud vehicles", async () => {
    mockFrom
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(createInsertBuilder({}));

    const result = await migrateGuestRepairRecordsToCloud("user_1");

    expect(mockedListAllRepairRecords).toHaveBeenCalledTimes(1);
    expect(mockedGetVehicleMigrationMappings).toHaveBeenCalledWith("user_1");
    expect(mockedGetVehicle).toHaveBeenCalledWith("local_vehicle_1", {
      includeArchived: true,
    });
    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 1,
      skippedCount: 0,
      skippedMissingVehicleMappingCount: 0,
      totalRepairRecords: 1,
    });
    expect(mockedRecalculateCloudVehicleOdometer).toHaveBeenCalledWith(
      "cloud_vehicle_1",
      "user_1",
      { includeArchived: true, preserveCurrent: true },
    );
    expect(mockedUpdateRepairRecordMigrationRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "completed",
      }),
    );
  });

  it("marks the run failed when every repair record is skipped for missing vehicle mappings", async () => {
    mockedGetVehicleMigrationMappings.mockResolvedValue([]);

    const result = await migrateGuestRepairRecordsToCloud("user_1");

    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 0,
      skippedMissingVehicleMappingCount: 1,
      totalRepairRecords: 1,
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockedUpdateRepairRecordMigrationRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });
});
