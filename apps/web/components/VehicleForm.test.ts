import { describe, expect, it } from "vitest";

import { vehicleToWebVehicleFormValues } from "../lib/cloud/vehicleFormValues";

describe("web vehicle form helpers", () => {
  it("maps an existing cloud vehicle into editable form values", () => {
    expect(
      vehicleToWebVehicleFormValues({
        archived_at: null,
        color: "Silver",
        created_at: "2026-01-01T00:00:00.000Z",
        current_odometer: 42000,
        id: "vehicle-1",
        initial_odometer: 40000,
        license_plate: "ABC123",
        license_state: "TX",
        local_id: "cloud_vehicle_1",
        make: "Toyota",
        model: "RAV4",
        nickname: "Family SUV",
        notes: "Primary road trip car",
        odometer_unit: "mi",
        purchase_date: "2025-12-01",
        purchase_odometer: 39000,
        sync_status: "synced",
        trim: "XLE",
        vehicle_type: "suv",
        vin: "123456789ABCDEFG",
        year: 2020,
        updated_at: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual({
      color: "Silver",
      current_odometer: "42000",
      license_plate: "ABC123",
      license_state: "TX",
      make: "Toyota",
      model: "RAV4",
      nickname: "Family SUV",
      notes: "Primary road trip car",
      odometer_unit: "mi",
      purchase_date: "2025-12-01",
      purchase_odometer: "39000",
      trim: "XLE",
      vehicle_type: "suv",
      vin: "123456789ABCDEFG",
      year: "2020",
    });
  });
});
