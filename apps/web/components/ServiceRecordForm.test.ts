import { describe, expect, it } from "vitest";

import {
  emptyWebServiceRecordFormValues,
  getTodayDateInputValue,
  serviceRecordToWebFormValues,
} from "../lib/cloud/serviceRecordFormValues";

const vehicle = {
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
  vehicle_type: "suv",
  vin: null,
  year: 2020,
  updated_at: "2026-01-02T00:00:00.000Z",
} as const;

describe("web service record form helpers", () => {
  it("defaults new service records to today, vehicle odometer, and USD", () => {
    expect(emptyWebServiceRecordFormValues(vehicle)).toEqual({
      category: "oil_change",
      cost_amount: "",
      cost_currency: "USD",
      description: "",
      notes: "",
      odometer_reading: "42000",
      service_date: getTodayDateInputValue(),
      title: "",
      vehicle_id: "vehicle-1",
      vendor_name: "",
    });
  });

  it("maps an existing service record into editable form values", () => {
    expect(
      serviceRecordToWebFormValues({
        category: "battery",
        cost_amount: 210.5,
        cost_currency: "USD",
        created_at: "2026-01-01T00:00:00.000Z",
        description: "Installed new battery",
        id: "svc-1",
        local_id: "cloud_svc_1",
        notes: "Warranty receipt saved in mobile",
        odometer_reading: 43000,
        service_date: "2026-01-02",
        sync_status: "synced",
        title: "Battery replacement",
        updated_at: "2026-01-02T00:00:00.000Z",
        vehicle_id: "vehicle-1",
        vendor_name: "Parts Store",
      }),
    ).toEqual({
      category: "battery",
      cost_amount: "210.5",
      cost_currency: "USD",
      description: "Installed new battery",
      notes: "Warranty receipt saved in mobile",
      odometer_reading: "43000",
      service_date: "2026-01-02",
      title: "Battery replacement",
      vehicle_id: "vehicle-1",
      vendor_name: "Parts Store",
    });
  });
});
