import { describe, expect, it } from "vitest";

import type {
  MaintenanceReminder,
  OdometerEntry,
  RecordAttachment,
  RepairRecord,
  ServiceRecord,
  Vehicle,
} from "@autoledger/shared";

import {
  exportWebCloudCsvByDataset,
  getWebCloudCsvExportSummary,
  hasWebCloudCsvExportData,
  isWebCloudCsvExportDatasetId,
  type WebCloudCsvExportData,
} from "./exportData";

const vehicle: Vehicle = {
  archived_at: null,
  color: null,
  created_at: "2026-01-01T00:00:00.000Z",
  current_odometer: 45000,
  id: "vehicle-1",
  initial_odometer: 40000,
  license_plate: null,
  license_state: null,
  local_id: "cloud_vehicle_1",
  make: "Toyota",
  model: "RAV4",
  nickname: "Family SUV",
  notes: null,
  odometer_unit: "mi",
  purchase_date: null,
  purchase_odometer: null,
  sync_status: "synced",
  trim: null,
  updated_at: "2026-01-02T00:00:00.000Z",
  vehicle_type: "suv",
  vin: null,
  year: 2021,
};

const serviceRecord: ServiceRecord = {
  category: "oil_change",
  cost_amount: 89.99,
  cost_currency: "USD",
  created_at: "2026-01-03T00:00:00.000Z",
  description: "Changed oil, filter, and checked tires.",
  id: "service-1",
  local_id: "cloud_service_1",
  notes: "Use synthetic next time.",
  odometer_reading: 44100,
  service_date: "2026-01-03",
  sync_status: "synced",
  title: 'Oil change, "winter"',
  updated_at: "2026-01-03T00:00:00.000Z",
  vehicle_id: vehicle.id,
  vendor_name: "ACME, Inc.",
};

const repairRecord: RepairRecord = {
  category: "brakes",
  cost_amount: 450,
  cost_currency: "USD",
  created_at: "2026-02-01T00:00:00.000Z",
  description: null,
  id: "repair-1",
  local_id: "cloud_repair_1",
  notes: null,
  odometer_reading: 44500,
  repair_date: "2026-02-01",
  sync_status: "synced",
  title: "Brake pads",
  updated_at: "2026-02-01T00:00:00.000Z",
  vehicle_id: vehicle.id,
  vendor_name: null,
  warranty_until_date: null,
  warranty_until_odometer: null,
};

const odometerEntry: OdometerEntry = {
  created_at: "2026-01-02T00:00:00.000Z",
  id: "odometer-1",
  local_id: "cloud_odometer_1",
  notes: "Driveway reading",
  odometer_unit: "mi",
  reading: 44000,
  reading_date: "2026-01-02",
  source_type: "manual",
  sync_status: "synced",
  updated_at: "2026-01-02T00:00:00.000Z",
  vehicle_id: vehicle.id,
};

const reminder: MaintenanceReminder = {
  category: "oil_change",
  completed_at: null,
  created_at: "2026-01-04T00:00:00.000Z",
  due_date: "2026-07-01",
  due_odometer: 49000,
  id: "reminder-1",
  is_completed: false,
  last_triggered_at: null,
  local_id: "cloud_reminder_1",
  notes: "Every six months or 5k miles.",
  reminder_type: "date_or_mileage",
  repeat_interval_miles: 5000,
  repeat_interval_months: 6,
  scheduled_notification_id: null,
  sync_status: "synced",
  title: "Next oil change",
  updated_at: "2026-01-04T00:00:00.000Z",
  vehicle_id: vehicle.id,
};

const attachment: RecordAttachment = {
  created_at: "2026-01-03T12:00:00.000Z",
  file_name: "receipt, oil.pdf",
  file_size_bytes: 2048,
  file_type: "pdf",
  id: "attachment-1",
  local_id: "cloud_attachment_1",
  local_uri: null,
  mime_type: "application/pdf",
  ocr_processed_at: null,
  ocr_status: "not_started",
  ocr_text: null,
  ocr_vendor: null,
  repair_record_id: null,
  service_record_id: serviceRecord.id,
  storage_bucket: "record-attachments",
  storage_path:
    "user-1/vehicles/vehicle-1/service-records/service-1/cloud_attachment_1-receipt_oil.pdf",
  sync_status: "synced",
  updated_at: "2026-01-03T12:00:00.000Z",
  vehicle_id: vehicle.id,
};

const emptyData: WebCloudCsvExportData = {
  maintenanceReminders: [],
  odometerEntries: [],
  recordAttachments: [],
  repairRecords: [],
  serviceRecords: [],
  vehicles: [],
};

const fullData: WebCloudCsvExportData = {
  maintenanceReminders: [reminder],
  odometerEntries: [odometerEntry],
  recordAttachments: [attachment],
  repairRecords: [repairRecord],
  serviceRecords: [serviceRecord],
  vehicles: [vehicle],
};

describe("web cloud CSV export helpers", () => {
  it("recognizes supported cloud export datasets", () => {
    expect(isWebCloudCsvExportDatasetId("vehicles")).toBe(true);
    expect(isWebCloudCsvExportDatasetId("attachment-metadata")).toBe(true);
    expect(isWebCloudCsvExportDatasetId("local-guest-data")).toBe(false);
  });

  it("handles empty cloud export data with header-only CSV files", () => {
    expect(hasWebCloudCsvExportData(emptyData)).toBe(false);
    expect(getWebCloudCsvExportSummary(emptyData)).toEqual({
      hasData: false,
      recordCounts: {
        attachmentMetadata: 0,
        maintenanceReminders: 0,
        odometerEntries: 0,
        repairRecords: 0,
        serviceRecords: 0,
        vehicles: 0,
      },
    });

    expect(exportWebCloudCsvByDataset({ data: emptyData, datasetId: "vehicles" }))
      .toBe(
        "vehicle_id,nickname,year,make,model,trim,vin,license_plate,license_state,color,vehicle_type,initial_odometer,current_odometer,odometer_unit,purchase_date,purchase_odometer,archived_at,notes,created_at,updated_at",
      );
  });

  it("exports cloud record CSV values using shared CSV escaping", () => {
    const csv = exportWebCloudCsvByDataset({
      data: fullData,
      datasetId: "service-records",
    });

    expect(csv).toContain('"Oil change, ""winter"""');
    expect(csv).toContain('"ACME, Inc."');
  });

  it("exports cloud attachment metadata without signed URLs or file binaries", () => {
    const csv = exportWebCloudCsvByDataset({
      data: fullData,
      datasetId: "attachment-metadata",
    });

    expect(csv).toContain("storage_bucket,storage_path");
    expect(csv).toContain("record-attachments");
    expect(csv).toContain(
      "user-1/vehicles/vehicle-1/service-records/service-1/cloud_attachment_1-receipt_oil.pdf",
    );
    expect(csv).toContain('"receipt, oil.pdf"');
    expect(csv).toContain("Family SUV");
    expect(csv).toContain('"Oil change, ""winter"""');
    expect(csv).not.toContain("signedUrl");
    expect(csv).not.toContain("https://");
  });
});

