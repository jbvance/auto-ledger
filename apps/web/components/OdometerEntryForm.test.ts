import { describe, expect, it } from "vitest";

import {
  emptyWebOdometerEntryFormValues,
  getTodayDateInputValue,
  odometerEntryToWebFormValues,
} from "../lib/cloud/odometerFormValues";

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

describe("web odometer entry form helpers", () => {
  it("defaults new entries to the vehicle unit, manual source, and today", () => {
    expect(
      emptyWebOdometerEntryFormValues(vehicle),
    ).toEqual({
      notes: "",
      odometer_unit: "mi",
      reading: "",
      reading_date: getTodayDateInputValue(),
      source_type: "manual",
      vehicle_id: "vehicle-1",
    });
  });

  it("maps an existing odometer entry into editable form values", () => {
    expect(
      odometerEntryToWebFormValues({
        created_at: "2026-01-01T00:00:00.000Z",
        id: "odo-1",
        local_id: "cloud_odo_1",
        notes: "After road trip",
        odometer_unit: "mi",
        reading: 43000,
        reading_date: "2026-01-02",
        source_type: "manual",
        sync_status: "synced",
        updated_at: "2026-01-02T00:00:00.000Z",
        vehicle_id: "vehicle-1",
      }),
    ).toEqual({
      notes: "After road trip",
      odometer_unit: "mi",
      reading: "43000",
      reading_date: "2026-01-02",
      source_type: "manual",
      vehicle_id: "vehicle-1",
    });
  });
});
