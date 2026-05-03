import type { ServiceRecord } from "@autoledger/shared";

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
  createServiceRecordMigrationRun: jest.fn(),
  getServiceRecordMigrationMappings: jest.fn(),
  getVehicleMigrationMappings: jest.fn(),
  updateServiceRecordMigrationRunStatus: jest.fn(),
  upsertServiceRecordMigrationMapping: jest.fn(),
}));

jest.mock("./serviceRecords", () => ({
  listAllServiceRecords: jest.fn(),
}));

jest.mock("./vehicles", () => ({
  getVehicle: jest.fn(),
}));

import {
  getCloudVehicleForOdometer,
  recalculateCloudVehicleOdometer,
} from "./cloudVehicleOdometer";
import {
  createServiceRecordMigrationRun,
  getVehicleMigrationMappings,
  updateServiceRecordMigrationRunStatus,
  upsertServiceRecordMigrationMapping,
} from "./guestMigration";
import {
  migrateGuestServiceRecordsToCloud,
  migrateGuestServiceRecordToCloud,
} from "./guestServiceRecordMigration";
import { listAllServiceRecords } from "./serviceRecords";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

const mockFrom = jest.mocked((supabase as unknown as { from: jest.Mock }).from);
const mockedCreateServiceRecordMigrationRun = jest.mocked(
  createServiceRecordMigrationRun,
);
const mockedGetCloudVehicleForOdometer = jest.mocked(
  getCloudVehicleForOdometer,
);
const mockedGetVehicle = jest.mocked(getVehicle);
const mockedGetVehicleMigrationMappings = jest.mocked(
  getVehicleMigrationMappings,
);
const mockedListAllServiceRecords = jest.mocked(listAllServiceRecords);
const mockedRecalculateCloudVehicleOdometer = jest.mocked(
  recalculateCloudVehicleOdometer,
);
const mockedUpdateServiceRecordMigrationRunStatus = jest.mocked(
  updateServiceRecordMigrationRunStatus,
);
const mockedUpsertServiceRecordMigrationMapping = jest.mocked(
  upsertServiceRecordMigrationMapping,
);

const now = "2026-05-02T12:00:00.000Z";

const serviceRecord: ServiceRecord = {
  category: "oil_change",
  cost_amount: 89.95,
  cost_currency: "USD",
  created_at: now,
  description: "Synthetic oil and filter",
  id: "local_service_pk_1",
  local_id: "guest_service_1",
  notes: "Used coupon",
  odometer_reading: 43000,
  service_date: "2026-05-01",
  sync_status: "local_only",
  title: "Oil change",
  updated_at: now,
  vehicle_id: "local_vehicle_1",
  vendor_name: "Neighborhood Auto",
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

const serviceRun = {
  account_id: "user_1",
  completed_at: null,
  created_at: now,
  error_message: null,
  failed_odometer_entries: 0,
  failed_repair_records: 0,
  failed_service_records: 0,
  failed_vehicles: 0,
  id: "run_service_1",
  migrated_odometer_entries: 0,
  migrated_repair_records: 0,
  migrated_service_records: 0,
  migrated_vehicles: 0,
  migration_scope: "service_records",
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
  total_repair_records: 0,
  total_service_records: 1,
  total_vehicles: 0,
  updated_at: now,
};

const cloudServiceRecordRow = {
  ...serviceRecord,
  id: "cloud_service_1",
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
  row = cloudServiceRecordRow,
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

describe("guest service record migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateServiceRecordMigrationRun.mockResolvedValue(serviceRun);
    mockedGetCloudVehicleForOdometer.mockResolvedValue({
      current_odometer: 42000,
      id: "cloud_vehicle_1",
      initial_odometer: 10000,
      odometer_unit: "mi",
      purchase_odometer: null,
    });
    mockedGetVehicle.mockResolvedValue({
      archived_at: null,
      color: null,
      created_at: now,
      current_odometer: 43000,
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
    mockedListAllServiceRecords.mockResolvedValue([serviceRecord]);
    mockedRecalculateCloudVehicleOdometer.mockResolvedValue(undefined);
    mockedUpdateServiceRecordMigrationRunStatus.mockResolvedValue(undefined);
    mockedUpsertServiceRecordMigrationMapping.mockResolvedValue({
      account_id: "user_1",
      cloud_id: "cloud_service_1",
      created_at: now,
      entity_type: "service_record",
      error_message: null,
      id: "service_mapping_1",
      local_id: serviceRecord.local_id,
      run_id: "run_service_1",
      status: "synced",
      updated_at: now,
    });
  });

  it("preserves local_id and maps key service fields to the mapped cloud vehicle", async () => {
    const existingRecordBuilder = createSelectBuilder({ row: null });
    const insertBuilder = createInsertBuilder({});
    mockFrom
      .mockReturnValueOnce(existingRecordBuilder)
      .mockReturnValueOnce(insertBuilder);

    const result = await migrateGuestServiceRecordToCloud(
      serviceRecord,
      "user_1",
      vehicleMapping,
      "run_service_1",
    );

    expect(result).toMatchObject({
      cloudId: "cloud_service_1",
      cloudVehicleId: "cloud_vehicle_1",
      localId: "guest_service_1",
      status: "migrated",
    });
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "oil_change",
        cost_amount: 89.95,
        cost_currency: "USD",
        created_at: serviceRecord.created_at,
        local_id: serviceRecord.local_id,
        odometer_reading: 43000,
        service_date: "2026-05-01",
        updated_at: serviceRecord.updated_at,
        user_id: "user_1",
        vehicle_id: "cloud_vehicle_1",
        vendor_id: null,
        vendor_name: "Neighborhood Auto",
      }),
    );
    expect(mockedUpsertServiceRecordMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "user_1",
        cloudId: "cloud_service_1",
        localId: "guest_service_1",
        runId: "run_service_1",
        status: "synced",
      }),
    );
  });

  it("skips records safely when the vehicle mapping is missing", async () => {
    const result = await migrateGuestServiceRecordToCloud(
      serviceRecord,
      "user_1",
      null,
      "run_service_1",
    );

    expect(result).toMatchObject({
      cloudId: null,
      status: "skipped_missing_vehicle_mapping",
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockedUpsertServiceRecordMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: null,
        localId: "guest_service_1",
        status: "skipped",
      }),
    );
  });

  it("reuses an existing cloud row and repairs the mapping on rerun", async () => {
    mockFrom.mockReturnValueOnce(
      createSelectBuilder({ row: cloudServiceRecordRow }),
    );

    const result = await migrateGuestServiceRecordToCloud(
      serviceRecord,
      "user_1",
      vehicleMapping,
      "run_service_1",
    );

    expect(result).toMatchObject({
      cloudId: "cloud_service_1",
      status: "already_migrated",
    });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockedUpsertServiceRecordMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "cloud_service_1",
        localId: "guest_service_1",
        status: "synced",
      }),
    );
  });

  it("migrates only service records, keeps local data untouched, and recalculates affected cloud vehicles", async () => {
    mockFrom
      .mockReturnValueOnce(createSelectBuilder({ row: null }))
      .mockReturnValueOnce(createInsertBuilder({}));

    const result = await migrateGuestServiceRecordsToCloud("user_1");

    expect(mockedListAllServiceRecords).toHaveBeenCalledTimes(1);
    expect(mockedGetVehicleMigrationMappings).toHaveBeenCalledWith("user_1");
    expect(mockedGetVehicle).toHaveBeenCalledWith("local_vehicle_1", {
      includeArchived: true,
    });
    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 1,
      skippedCount: 0,
      skippedMissingVehicleMappingCount: 0,
      totalServiceRecords: 1,
    });
    expect(mockedRecalculateCloudVehicleOdometer).toHaveBeenCalledWith(
      "cloud_vehicle_1",
      "user_1",
      { includeArchived: true, preserveCurrent: true },
    );
    expect(
      mockedUpdateServiceRecordMigrationRunStatus,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "completed",
      }),
    );
  });

  it("marks the run failed when every service record is skipped for missing vehicle mappings", async () => {
    mockedGetVehicleMigrationMappings.mockResolvedValue([]);

    const result = await migrateGuestServiceRecordsToCloud("user_1");

    expect(result).toMatchObject({
      failedCount: 0,
      migratedCount: 0,
      skippedMissingVehicleMappingCount: 1,
      totalServiceRecords: 1,
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(
      mockedUpdateServiceRecordMigrationRunStatus,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });
});
