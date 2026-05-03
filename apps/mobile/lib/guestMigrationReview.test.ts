import {
  buildMigrationReviewSummary,
  localDataRetentionMessage,
  runGuestMigrationReviewStep,
  type MigrationReviewBuildInput,
} from "./guestMigrationReview";
import type {
  GuestMigrationSummary,
  LatestMigrationRunsByScope,
  MigrationEntityMapping,
  MigrationRun,
} from "./guestMigration";
import { migrateGuestAttachmentsToCloud } from "./guestAttachmentMigration";
import { migrateGuestVehiclesToCloud } from "./guestVehicleMigration";

jest.mock("./guestAttachmentMigration", () => ({
  migrateGuestAttachmentsToCloud: jest.fn(),
}));

jest.mock("./guestMaintenanceReminderMigration", () => ({
  migrateGuestMaintenanceRemindersToCloud: jest.fn(),
}));

jest.mock("./guestOdometerMigration", () => ({
  migrateGuestOdometerEntriesToCloud: jest.fn(),
}));

jest.mock("./guestRepairRecordMigration", () => ({
  migrateGuestRepairRecordsToCloud: jest.fn(),
}));

jest.mock("./guestServiceRecordMigration", () => ({
  migrateGuestServiceRecordsToCloud: jest.fn(),
}));

jest.mock("./guestVehicleMigration", () => ({
  migrateGuestVehiclesToCloud: jest.fn(),
}));

const createGuestSummary = (
  overrides: Partial<GuestMigrationSummary["counts"]> = {},
): GuestMigrationSummary => {
  const counts = {
    activeVehicles: 1,
    archivedVehicles: 0,
    attachments: 0,
    completedReminders: 0,
    maintenanceReminders: 0,
    odometerEntries: 0,
    repairRecords: 0,
    serviceRecords: 0,
    totalRecords: 1,
    totalVehicles: 1,
    ...overrides,
  };

  return {
    accountId: "user_1",
    counts,
    hasGuestData:
      counts.totalVehicles +
        counts.odometerEntries +
        counts.serviceRecords +
        counts.repairRecords +
        counts.maintenanceReminders +
        counts.attachments >
      0,
    warnings: [],
  };
};

const emptyLatestRuns = (): LatestMigrationRunsByScope => ({
  full: null,
  maintenance_reminders: null,
  odometer_entries: null,
  record_attachments: null,
  repair_records: null,
  service_records: null,
  vehicles: null,
});

const createRun = (overrides: Partial<MigrationRun> = {}): MigrationRun => ({
  account_id: "user_1",
  completed_at: "2026-05-03T12:01:00.000Z",
  created_at: "2026-05-03T12:00:00.000Z",
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
  started_at: "2026-05-03T12:00:00.000Z",
  status: "completed",
  total_odometer_entries: 0,
  total_repair_records: 0,
  total_service_records: 0,
  total_vehicles: 1,
  updated_at: "2026-05-03T12:01:00.000Z",
  ...overrides,
});

const createMapping = (
  overrides: Partial<MigrationEntityMapping> = {},
): MigrationEntityMapping => ({
  account_id: "user_1",
  cloud_id: "cloud_1",
  created_at: "2026-05-03T12:00:00.000Z",
  entity_type: "vehicle",
  error_message: null,
  id: "mapping_1",
  local_id: "local_1",
  run_id: "run_1",
  status: "synced",
  updated_at: "2026-05-03T12:00:00.000Z",
  ...overrides,
});

const createBuildInput = (
  overrides: Partial<MigrationReviewBuildInput> = {},
): MigrationReviewBuildInput => ({
  attachmentMappings: [],
  guestSummary: createGuestSummary(),
  latestRuns: emptyLatestRuns(),
  maintenanceReminderMappings: [],
  odometerMappings: [],
  repairRecordMappings: [],
  serviceRecordMappings: [],
  vehicleMappings: [],
  ...overrides,
});

describe("guest migration review summary", () => {
  it("counts synced, skipped, and failed mappings by entity type", () => {
    const summary = buildMigrationReviewSummary(
      createBuildInput({
        guestSummary: createGuestSummary({
          odometerEntries: 2,
          totalRecords: 3,
        }),
        odometerMappings: [
          createMapping({
            cloud_id: "cloud_odo_1",
            entity_type: "odometer_entry",
            local_id: "odo_1",
          }),
          createMapping({
            cloud_id: null,
            entity_type: "odometer_entry",
            error_message: "Vehicle mapping missing.",
            local_id: "odo_2",
            status: "skipped",
          }),
        ],
        vehicleMappings: [
          createMapping({
            cloud_id: "cloud_vehicle_1",
            entity_type: "vehicle",
            local_id: "vehicle_1",
          }),
        ],
      }),
    );

    const odometerStep = summary.steps.find(
      (step) => step.key === "odometer_entries",
    );

    expect(summary.mappingTotals.synced).toBe(2);
    expect(summary.mappingTotals.skipped).toBe(1);
    expect(odometerStep).toMatchObject({
      failedCount: 0,
      migratedCount: 1,
      skippedCount: 1,
      status: "completed_with_errors",
    });
  });

  it("calculates not started, ready, blocked, completed, and failed step statuses", () => {
    const summary = buildMigrationReviewSummary(
      createBuildInput({
        attachmentMappings: [
          createMapping({
            cloud_id: null,
            entity_type: "record_attachment",
            local_id: "att_1",
            status: "failed",
          }),
        ],
        guestSummary: createGuestSummary({
          attachments: 1,
          maintenanceReminders: 1,
          odometerEntries: 1,
          repairRecords: 1,
          serviceRecords: 1,
          totalRecords: 5,
        }),
        serviceRecordMappings: [
          createMapping({
            entity_type: "service_record",
            local_id: "svc_1",
          }),
        ],
        vehicleMappings: [],
      }),
    );

    expect(summary.steps.find((step) => step.key === "vehicles")?.status).toBe(
      "not_started",
    );
    expect(
      summary.steps.find((step) => step.key === "odometer_entries")?.status,
    ).toBe("blocked");
    expect(
      summary.steps.find((step) => step.key === "service_records")?.status,
    ).toBe("completed");
    expect(
      summary.steps.find((step) => step.key === "record_attachments")?.status,
    ).toBe("failed");
  });

  it("blocks attachments until service or repair parent mappings exist", () => {
    const summary = buildMigrationReviewSummary(
      createBuildInput({
        guestSummary: createGuestSummary({
          attachments: 1,
          totalRecords: 2,
        }),
        vehicleMappings: [
          createMapping({
            entity_type: "vehicle",
          }),
        ],
      }),
    );

    const attachmentStep = summary.steps.find(
      (step) => step.key === "record_attachments",
    );

    expect(attachmentStep).toMatchObject({
      blockedReason:
        "Copy service or repair records before migrating attachments.",
      canRun: false,
      status: "blocked",
    });
  });

  it("uses completion messaging that does not imply local deletion", () => {
    const summary = buildMigrationReviewSummary(
      createBuildInput({
        vehicleMappings: [
          createMapping({
            entity_type: "vehicle",
            local_id: "vehicle_1",
          }),
        ],
      }),
    );

    expect(summary.isComplete).toBe(true);
    expect(summary.completionMessage).toContain(
      "copied to your account",
    );
    expect(summary.completionMessage).toContain(localDataRetentionMessage);
    expect(summary.completionMessage).not.toContain("deleted");
  });
});

describe("guest migration review retry dispatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls the vehicle migration helper for vehicle retry", async () => {
    jest.mocked(migrateGuestVehiclesToCloud).mockResolvedValue({
      failedCount: 0,
      migratedCount: 1,
      results: [],
      run: createRun(),
      skippedCount: 0,
      totalVehicles: 1,
    });

    const result = await runGuestMigrationReviewStep({
      accountId: "user_1",
      stepKey: "vehicles",
    });

    expect(migrateGuestVehiclesToCloud).toHaveBeenCalledWith("user_1");
    expect(result).toMatchObject({
      issueCount: 0,
      migratedCount: 1,
      stepKey: "vehicles",
    });
  });

  it("calls the attachment migration helper for attachment retry", async () => {
    jest.mocked(migrateGuestAttachmentsToCloud).mockResolvedValue({
      failedCleanupCount: 0,
      failedCount: 1,
      failedMetadataCount: 0,
      failedUploadCount: 1,
      migratedCount: 0,
      results: [],
      run: createRun({
        failed_record_attachments: 1,
        migration_scope: "record_attachments",
        status: "failed",
      }),
      skippedAlreadyMigratedCount: 0,
      skippedMissingParentMappingCount: 0,
      skippedUnsupportedCount: 0,
      totalAttachments: 1,
    });

    const result = await runGuestMigrationReviewStep({
      accountId: "user_1",
      stepKey: "record_attachments",
    });

    expect(migrateGuestAttachmentsToCloud).toHaveBeenCalledWith("user_1");
    expect(result).toMatchObject({
      issueCount: 1,
      stepKey: "record_attachments",
      status: "failed",
    });
  });
});
