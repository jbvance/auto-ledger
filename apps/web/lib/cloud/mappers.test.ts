import { describe, expect, it } from "vitest";

import {
  mapCloudOdometerEntryRow,
  mapCloudRepairRecordRow,
  mapCloudServiceRecordRow,
  mapCloudVehicleRow,
  type CloudOdometerEntryRow,
  type CloudRepairRecordRow,
  type CloudServiceRecordRow,
  type CloudVehicleRow,
} from "./mappers";

const baseVehicleRow: CloudVehicleRow = {
  archived_at: null,
  color: null,
  created_at: "2026-01-01T00:00:00.000Z",
  current_odometer: 42000,
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
  user_id: "user-1",
  vehicle_type: "suv",
  vin: null,
  year: 2020,
  updated_at: "2026-01-02T00:00:00.000Z",
};

describe("web cloud mappers", () => {
  it("maps cloud vehicle enum strings into shared vehicle types", () => {
    const vehicle = mapCloudVehicleRow(baseVehicleRow);

    expect(vehicle.nickname).toBe("Family SUV");
    expect(vehicle.odometer_unit).toBe("mi");
    expect(vehicle.vehicle_type).toBe("suv");
    expect(vehicle.sync_status).toBe("synced");
  });

  it("maps cloud odometer entry enum strings into shared odometer types", () => {
    const row: CloudOdometerEntryRow = {
      created_at: "2026-01-01T00:00:00.000Z",
      id: "odo-1",
      local_id: "cloud_odo_1",
      notes: null,
      odometer_unit: "mi",
      reading: 43000,
      reading_date: "2026-01-02",
      source_type: "manual",
      sync_status: "synced",
      updated_at: "2026-01-02T00:00:00.000Z",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
    };

    expect(mapCloudOdometerEntryRow(row)).toMatchObject({
      odometer_unit: "mi",
      source_type: "manual",
      sync_status: "synced",
    });
  });

  it("normalizes numeric cloud service costs", () => {
    const row: CloudServiceRecordRow = {
      category: "oil_change",
      cost_amount: "89.95",
      cost_currency: "USD",
      created_at: "2026-01-01T00:00:00.000Z",
      description: null,
      id: "service-1",
      local_id: "cloud_service_1",
      notes: null,
      odometer_reading: 41000,
      service_date: "2026-01-01",
      sync_status: "synced",
      title: "Oil change",
      updated_at: "2026-01-01T00:00:00.000Z",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
      vendor_id: null,
      vendor_name: "Local Shop",
    };

    expect(mapCloudServiceRecordRow(row).cost_amount).toBe(89.95);
  });

  it("normalizes numeric cloud repair costs", () => {
    const row: CloudRepairRecordRow = {
      category: "brakes",
      cost_amount: "420.5",
      cost_currency: "USD",
      created_at: "2026-01-01T00:00:00.000Z",
      description: null,
      id: "repair-1",
      local_id: "cloud_repair_1",
      notes: null,
      odometer_reading: 41500,
      repair_date: "2026-01-03",
      sync_status: "synced",
      title: "Brake repair",
      updated_at: "2026-01-03T00:00:00.000Z",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
      vendor_id: null,
      vendor_name: null,
      warranty_until_date: null,
      warranty_until_odometer: null,
    };

    expect(mapCloudRepairRecordRow(row).cost_amount).toBe(420.5);
  });
});
