import type {
  RecordAttachment,
  RepairRecord,
  ServiceRecord,
  Vehicle,
} from "@autoledger/shared";

jest.mock("./guestMigration", () => ({
  createRecordAttachmentMigrationRun: jest.fn(),
  getAttachmentMigrationMappings: jest.fn(),
  getRepairRecordMigrationMappings: jest.fn(),
  getServiceRecordMigrationMappings: jest.fn(),
  getVehicleMigrationMappings: jest.fn(),
  updateRecordAttachmentMigrationRunStatus: jest.fn(),
  upsertAttachmentMigrationMapping: jest.fn(),
}));

jest.mock("./cloudRecordAttachments", () => {
  const actual = jest.requireActual("./cloudRecordAttachments");

  return {
    ...actual,
    getCloudAttachmentByLocalIdForUser: jest.fn(),
    insertCloudAttachmentMetadataWithUploadCleanup: jest.fn(),
    uploadLocalFileToStorage: jest.fn(),
  };
});

jest.mock("./repairRecords", () => ({
  getRepairRecord: jest.fn(),
}));

jest.mock("./serviceRecords", () => ({
  getServiceRecord: jest.fn(),
}));

jest.mock("./recordAttachments", () => ({
  deleteAttachment: jest.fn(),
  listAllAttachments: jest.fn(),
}));

jest.mock("./vehicles", () => ({
  getVehicle: jest.fn(),
}));

import {
  getCloudAttachmentByLocalIdForUser,
  insertCloudAttachmentMetadataWithUploadCleanup,
  uploadLocalFileToStorage,
} from "./cloudRecordAttachments";
import {
  upsertAttachmentMigrationMapping,
  type MigrationEntityMapping,
} from "./guestMigration";
import {
  migrateGuestAttachmentToCloud,
  resolveGuestAttachmentParentMappings,
} from "./guestAttachmentMigration";
import { deleteAttachment } from "./recordAttachments";
import { getRepairRecord } from "./repairRecords";
import { getServiceRecord } from "./serviceRecords";
import { getVehicle } from "./vehicles";

const mockedDeleteAttachment = jest.mocked(deleteAttachment);
const mockedGetCloudAttachmentByLocalIdForUser = jest.mocked(
  getCloudAttachmentByLocalIdForUser,
);
const mockedInsertCloudAttachmentMetadataWithUploadCleanup = jest.mocked(
  insertCloudAttachmentMetadataWithUploadCleanup,
);
const mockedGetRepairRecord = jest.mocked(getRepairRecord);
const mockedGetServiceRecord = jest.mocked(getServiceRecord);
const mockedGetVehicle = jest.mocked(getVehicle);
const mockedUploadLocalFileToStorage = jest.mocked(uploadLocalFileToStorage);
const mockedUpsertAttachmentMigrationMapping = jest.mocked(
  upsertAttachmentMigrationMapping,
);

const now = "2026-05-02T12:00:00.000Z";

const vehicle: Vehicle = {
  archived_at: null,
  color: null,
  created_at: now,
  current_odometer: 43000,
  id: "local_vehicle_pk_1",
  initial_odometer: 10000,
  license_plate: null,
  license_state: null,
  local_id: "guest_vehicle_1",
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
};

const serviceRecord: ServiceRecord = {
  category: "oil_change",
  cost_amount: 89.95,
  cost_currency: "USD",
  created_at: now,
  description: "Synthetic oil and filter",
  id: "local_service_pk_1",
  local_id: "guest_service_1",
  notes: null,
  odometer_reading: 43000,
  service_date: "2026-05-01",
  sync_status: "local_only",
  title: "Oil change",
  updated_at: now,
  vehicle_id: vehicle.id,
  vendor_name: "Neighborhood Auto",
};

const repairRecord: RepairRecord = {
  category: "electrical",
  cost_amount: 489.75,
  cost_currency: "USD",
  created_at: now,
  description: "Replaced alternator",
  id: "local_repair_pk_1",
  local_id: "guest_repair_1",
  notes: null,
  odometer_reading: 73500,
  repair_date: "2026-04-30",
  sync_status: "local_only",
  title: "Alternator replacement",
  updated_at: now,
  vehicle_id: vehicle.id,
  vendor_name: "Neighborhood Auto",
  warranty_until_date: null,
  warranty_until_odometer: null,
};

const serviceAttachment: RecordAttachment = {
  created_at: now,
  file_name: "receipt.pdf",
  file_size_bytes: 2048,
  file_type: "pdf",
  id: "local_attachment_pk_1",
  local_id: "guest_attachment_1",
  local_uri: "file:///local/receipt.pdf",
  mime_type: "application/pdf",
  ocr_processed_at: null,
  ocr_status: "not_started",
  ocr_text: null,
  ocr_vendor: null,
  repair_record_id: null,
  service_record_id: serviceRecord.id,
  storage_bucket: null,
  storage_path: null,
  sync_status: "local_only",
  updated_at: now,
  vehicle_id: vehicle.id,
};

const repairAttachment: RecordAttachment = {
  ...serviceAttachment,
  id: "local_attachment_pk_2",
  local_id: "guest_attachment_2",
  repair_record_id: repairRecord.id,
  service_record_id: null,
};

const createMapping = (
  entityType: MigrationEntityMapping["entity_type"],
  localId: string,
  cloudId: string | null,
  status: MigrationEntityMapping["status"] = "synced",
): MigrationEntityMapping => ({
  account_id: "user_1",
  cloud_id: cloudId,
  created_at: now,
  entity_type: entityType,
  error_message: null,
  id: `${entityType}_${localId}_mapping`,
  local_id: localId,
  run_id: "run_1",
  status,
  updated_at: now,
});

const vehicleMapping = createMapping("vehicle", vehicle.local_id, "cloud_vehicle_1");
const serviceRecordMapping = createMapping(
  "service_record",
  serviceRecord.local_id,
  "cloud_service_1",
);
const repairRecordMapping = createMapping(
  "repair_record",
  repairRecord.local_id,
  "cloud_repair_1",
);

describe("guest attachment migration parent mapping resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCloudAttachmentByLocalIdForUser.mockResolvedValue(null);
    mockedGetServiceRecord.mockResolvedValue(serviceRecord);
    mockedGetRepairRecord.mockResolvedValue(repairRecord);
    mockedGetVehicle.mockResolvedValue(vehicle);
    mockedInsertCloudAttachmentMetadataWithUploadCleanup.mockResolvedValue({
      attachment: {
        ...serviceAttachment,
        id: "cloud_attachment_1",
        local_uri: null,
        service_record_id: "cloud_service_1",
        storage_bucket: "record-attachments",
        storage_path:
          "user_1/vehicles/cloud_vehicle_1/service-records/cloud_service_1/guest_attachment_1-receipt.pdf",
        sync_status: "synced",
        vehicle_id: "cloud_vehicle_1",
      },
      cleanupErrorMessage: null,
      errorMessage: null,
      status: "saved",
      storageBucket: "record-attachments",
      storagePath:
        "user_1/vehicles/cloud_vehicle_1/service-records/cloud_service_1/guest_attachment_1-receipt.pdf",
    });
    mockedUploadLocalFileToStorage.mockResolvedValue({
      sizeBytes: 2048,
      status: "uploaded",
    });
    mockedUpsertAttachmentMigrationMapping.mockResolvedValue(
      createMapping("record_attachment", "guest_attachment_1", "cloud_attachment_1"),
    );
  });

  it("resolves service attachment parents through the parent local_id mapping", async () => {
    const result = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: serviceAttachment,
      repairRecordMappings: [],
      serviceRecordMappings: [serviceRecordMapping],
      vehicleMappings: [vehicleMapping],
    });

    expect(mockedGetServiceRecord).toHaveBeenCalledWith(serviceRecord.id);
    expect(mockedGetVehicle).toHaveBeenCalledWith(vehicle.id, {
      includeArchived: true,
    });
    expect(result).toMatchObject({
      attachmentLocalId: "guest_attachment_1",
      cloudParentRecordId: "cloud_service_1",
      cloudVehicleId: "cloud_vehicle_1",
      localRetention: {
        localAttachmentId: "local_attachment_pk_1",
        localAttachmentLocalId: "guest_attachment_1",
        localFileUri: "file:///local/receipt.pdf",
        shouldDeleteLocalFile: false,
        shouldDeleteLocalRecord: false,
      },
      localParentId: "local_service_pk_1",
      localParentLocalId: "guest_service_1",
      localVehicleId: "local_vehicle_pk_1",
      localVehicleLocalId: "guest_vehicle_1",
      recordType: "service",
      status: "ready",
    });
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });

  it("resolves repair attachment parents through the parent local_id mapping", async () => {
    const result = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: repairAttachment,
      repairRecordMappings: [repairRecordMapping],
      serviceRecordMappings: [],
      vehicleMappings: [vehicleMapping],
    });

    expect(mockedGetRepairRecord).toHaveBeenCalledWith(repairRecord.id);
    expect(result).toMatchObject({
      attachmentLocalId: "guest_attachment_2",
      cloudParentRecordId: "cloud_repair_1",
      cloudVehicleId: "cloud_vehicle_1",
      localRetention: expect.objectContaining({
        localAttachmentId: "local_attachment_pk_2",
        localAttachmentLocalId: "guest_attachment_2",
        localFileUri: "file:///local/receipt.pdf",
        shouldDeleteLocalFile: false,
        shouldDeleteLocalRecord: false,
      }),
      localParentId: "local_repair_pk_1",
      localParentLocalId: "guest_repair_1",
      recordType: "repair",
      status: "ready",
    });
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });

  it("does not treat the attachment parent row id as the cloud parent mapping key", async () => {
    const mappingByRawParentId = createMapping(
      "service_record",
      serviceRecord.id,
      "wrong_cloud_service_1",
    );

    const result = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: serviceAttachment,
      repairRecordMappings: [],
      serviceRecordMappings: [mappingByRawParentId],
      vehicleMappings: [vehicleMapping],
    });

    expect(result).toMatchObject({
      cloudParentRecordId: null,
      cloudVehicleId: "cloud_vehicle_1",
      localRetention: expect.objectContaining({
        shouldDeleteLocalFile: false,
        shouldDeleteLocalRecord: false,
      }),
      localParentLocalId: "guest_service_1",
      status: "missing_parent_mapping",
    });
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });

  it("blocks malformed attachments before resolving mappings", async () => {
    const result = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: {
        ...serviceAttachment,
        repair_record_id: repairRecord.id,
      },
      repairRecordMappings: [repairRecordMapping],
      serviceRecordMappings: [serviceRecordMapping],
      vehicleMappings: [vehicleMapping],
    });

    expect(result).toMatchObject({
      localRetention: expect.objectContaining({
        localAttachmentId: "local_attachment_pk_1",
        localFileUri: "file:///local/receipt.pdf",
        shouldDeleteLocalFile: false,
        shouldDeleteLocalRecord: false,
      }),
      recordType: null,
      status: "invalid_parent",
    });
    expect(mockedGetServiceRecord).not.toHaveBeenCalled();
    expect(mockedGetRepairRecord).not.toHaveBeenCalled();
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });

  it("blocks attachments when the local parent and attachment vehicle differ", async () => {
    const result = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: {
        ...serviceAttachment,
        vehicle_id: "different_local_vehicle",
      },
      repairRecordMappings: [],
      serviceRecordMappings: [serviceRecordMapping],
      vehicleMappings: [vehicleMapping],
    });

    expect(result).toMatchObject({
      cloudParentRecordId: null,
      cloudVehicleId: null,
      localRetention: expect.objectContaining({
        shouldDeleteLocalFile: false,
        shouldDeleteLocalRecord: false,
      }),
      localParentLocalId: "guest_service_1",
      status: "vehicle_mismatch",
    });
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });

  it("migrates a service attachment with the preserved local_id and mapping row", async () => {
    const resolution = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: serviceAttachment,
      repairRecordMappings: [],
      serviceRecordMappings: [serviceRecordMapping],
      vehicleMappings: [vehicleMapping],
    });

    const result = await migrateGuestAttachmentToCloud(
      serviceAttachment,
      "user_1",
      resolution,
      "run_1",
    );

    expect(mockedUploadLocalFileToStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        allowExistingObject: true,
        contentType: "application/pdf",
        fileType: "pdf",
        localUri: "file:///local/receipt.pdf",
        path: "user_1/vehicles/cloud_vehicle_1/service-records/cloud_service_1/guest_attachment_1-receipt.pdf",
      }),
    );
    expect(
      mockedInsertCloudAttachmentMetadataWithUploadCleanup,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          local_id: "guest_attachment_1",
          local_uri: null,
          service_record_id: "cloud_service_1",
          storage_path:
            "user_1/vehicles/cloud_vehicle_1/service-records/cloud_service_1/guest_attachment_1-receipt.pdf",
          user_id: "user_1",
          vehicle_id: "cloud_vehicle_1",
        }),
      }),
    );
    expect(mockedUpsertAttachmentMigrationMapping).toHaveBeenCalledWith({
      accountId: "user_1",
      cloudId: "cloud_attachment_1",
      localId: "guest_attachment_1",
      runId: "run_1",
      status: "synced",
    });
    expect(result).toMatchObject({
      cloudId: "cloud_attachment_1",
      localId: "guest_attachment_1",
      status: "migrated",
    });
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });

  it("reuses existing cloud metadata without uploading on rerun", async () => {
    mockedGetCloudAttachmentByLocalIdForUser.mockResolvedValueOnce({
      ...serviceAttachment,
      id: "cloud_attachment_1",
      local_uri: null,
      service_record_id: "cloud_service_1",
      storage_bucket: "record-attachments",
      storage_path:
        "user_1/vehicles/cloud_vehicle_1/service-records/cloud_service_1/guest_attachment_1-receipt.pdf",
      sync_status: "synced",
      vehicle_id: "cloud_vehicle_1",
    });
    const resolution = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: serviceAttachment,
      repairRecordMappings: [],
      serviceRecordMappings: [serviceRecordMapping],
      vehicleMappings: [vehicleMapping],
    });

    const result = await migrateGuestAttachmentToCloud(
      serviceAttachment,
      "user_1",
      resolution,
      "run_1",
    );

    expect(mockedUploadLocalFileToStorage).not.toHaveBeenCalled();
    expect(mockedInsertCloudAttachmentMetadataWithUploadCleanup).not.toHaveBeenCalled();
    expect(mockedUpsertAttachmentMigrationMapping).toHaveBeenCalledWith({
      accountId: "user_1",
      cloudId: "cloud_attachment_1",
      localId: "guest_attachment_1",
      runId: "run_1",
      status: "synced",
    });
    expect(result.status).toBe("already_migrated");
  });

  it("skips safely when the parent mapping is missing", async () => {
    const resolution = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: serviceAttachment,
      repairRecordMappings: [],
      serviceRecordMappings: [],
      vehicleMappings: [vehicleMapping],
    });

    const result = await migrateGuestAttachmentToCloud(
      serviceAttachment,
      "user_1",
      resolution,
      "run_1",
    );

    expect(mockedUploadLocalFileToStorage).not.toHaveBeenCalled();
    expect(mockedInsertCloudAttachmentMetadataWithUploadCleanup).not.toHaveBeenCalled();
    expect(mockedUpsertAttachmentMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: null,
        localId: "guest_attachment_1",
        status: "skipped",
      }),
    );
    expect(result.status).toBe("skipped_missing_parent_mapping");
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });

  it("skips unsupported attachment relationships", async () => {
    const malformedAttachment = {
      ...serviceAttachment,
      repair_record_id: repairRecord.id,
    };
    const resolution = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: malformedAttachment,
      repairRecordMappings: [repairRecordMapping],
      serviceRecordMappings: [serviceRecordMapping],
      vehicleMappings: [vehicleMapping],
    });

    const result = await migrateGuestAttachmentToCloud(
      malformedAttachment,
      "user_1",
      resolution,
      "run_1",
    );

    expect(mockedUploadLocalFileToStorage).not.toHaveBeenCalled();
    expect(result.status).toBe("skipped_unsupported");
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });

  it("records upload failure when the local file is missing", async () => {
    mockedUploadLocalFileToStorage.mockRejectedValueOnce(
      new Error("Attachment file is no longer available on this device."),
    );
    const resolution = await resolveGuestAttachmentParentMappings({
      accountId: "user_1",
      attachment: serviceAttachment,
      repairRecordMappings: [],
      serviceRecordMappings: [serviceRecordMapping],
      vehicleMappings: [vehicleMapping],
    });

    const result = await migrateGuestAttachmentToCloud(
      serviceAttachment,
      "user_1",
      resolution,
      "run_1",
    );

    expect(mockedInsertCloudAttachmentMetadataWithUploadCleanup).not.toHaveBeenCalled();
    expect(mockedUpsertAttachmentMigrationMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: null,
        errorMessage:
          "Attachment file is no longer available on this device.",
        localId: "guest_attachment_1",
        status: "failed",
      }),
    );
    expect(result.status).toBe("failed_upload");
    expect(mockedDeleteAttachment).not.toHaveBeenCalled();
  });
});
