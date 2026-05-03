import { describe, expect, it } from "vitest";

import {
  emptyWebRepairRecordFormValues,
  getTodayDateInputValue,
  repairRecordToWebFormValues,
} from "../lib/cloud/repairRecordFormValues";

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

describe("web repair record form helpers", () => {
  it("defaults new repair records to today, vehicle odometer, USD, and empty warranty fields", () => {
    expect(emptyWebRepairRecordFormValues(vehicle)).toEqual({
      category: "brakes",
      cost_amount: "",
      cost_currency: "USD",
      description: "",
      notes: "",
      odometer_reading: "42000",
      repair_date: getTodayDateInputValue(),
      title: "",
      vehicle_id: "vehicle-1",
      vendor_name: "",
      warranty_until_date: "",
      warranty_until_odometer: "",
    });
  });

  it("maps an existing repair record into editable form values", () => {
    expect(
      repairRecordToWebFormValues({
        category: "electrical",
        cost_amount: 310.75,
        cost_currency: "USD",
        created_at: "2026-01-01T00:00:00.000Z",
        description: "Replaced alternator",
        id: "rep-1",
        local_id: "cloud_rep_1",
        notes: "Warranty receipt saved in mobile",
        odometer_reading: 43000,
        repair_date: "2026-01-02",
        sync_status: "synced",
        title: "Alternator replacement",
        updated_at: "2026-01-02T00:00:00.000Z",
        vehicle_id: "vehicle-1",
        vendor_name: "Parts Store",
        warranty_until_date: "2027-01-02",
        warranty_until_odometer: 55000,
      }),
    ).toEqual({
      category: "electrical",
      cost_amount: "310.75",
      cost_currency: "USD",
      description: "Replaced alternator",
      notes: "Warranty receipt saved in mobile",
      odometer_reading: "43000",
      repair_date: "2026-01-02",
      title: "Alternator replacement",
      vehicle_id: "vehicle-1",
      vendor_name: "Parts Store",
      warranty_until_date: "2027-01-02",
      warranty_until_odometer: "55000",
    });
  });
});
