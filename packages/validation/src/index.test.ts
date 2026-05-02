import { describe, expect, it } from "vitest";

import {
  maintenanceReminderSchema,
  odometerEntrySchema,
  recordAttachmentSchema,
  repairRecordSchema,
  serviceRecordSchema,
  vehicleSchema,
} from "./index";

const vehicleInput = {
  color: "",
  current_odometer: "24000",
  license_plate: "",
  license_state: "",
  make: "Honda",
  model: "CR-V",
  nickname: "Family car",
  notes: "",
  odometer_unit: "mi",
  purchase_date: "",
  purchase_odometer: "",
  trim: "",
  vehicle_type: "suv",
  vin: "",
  year: "2020",
};

describe("vehicleSchema", () => {
  it("coerces valid form values and trims optional empty strings", () => {
    const parsed = vehicleSchema.parse({
      ...vehicleInput,
      purchase_odometer: "12000",
      trim: " EX ",
    });

    expect(parsed.current_odometer).toBe(24000);
    expect(parsed.purchase_odometer).toBe(12000);
    expect(parsed.trim).toBe("EX");
    expect(parsed.notes).toBeUndefined();
  });

  it("rejects a purchase odometer above the current odometer", () => {
    const result = vehicleSchema.safeParse({
      ...vehicleInput,
      current_odometer: "10000",
      purchase_odometer: "12000",
    });

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some(
        (issue) => issue.path[0] === "purchase_odometer",
      ),
    ).toBe(true);
  });
});

describe("odometerEntrySchema", () => {
  it("requires a valid date and non-negative reading", () => {
    expect(
      odometerEntrySchema.safeParse({
        odometer_unit: "mi",
        notes: "",
        reading: "-1",
        reading_date: "2026-02-31",
        source_type: "manual",
        vehicle_id: "veh_1",
      }).success,
    ).toBe(false);

    expect(
      odometerEntrySchema.parse({
        odometer_unit: "mi",
        notes: "",
        reading: "25000",
        reading_date: "2026-05-02",
        source_type: "manual",
        vehicle_id: "veh_1",
      }).reading,
    ).toBe(25000);
  });
});

describe("serviceRecordSchema", () => {
  it("defaults USD currency and coerces optional cost/odometer fields", () => {
    const parsed = serviceRecordSchema.parse({
      category: "oil_change",
      cost_amount: "89.95",
      cost_currency: "",
      description: "",
      notes: "",
      odometer_reading: "25000",
      service_date: "2026-05-02",
      title: "Oil change",
      vehicle_id: "veh_1",
      vendor_name: "",
    });

    expect(parsed.cost_amount).toBe(89.95);
    expect(parsed.cost_currency).toBe("USD");
    expect(parsed.odometer_reading).toBe(25000);
  });
});

describe("repairRecordSchema", () => {
  it("validates warranty date and odometer fields", () => {
    const valid = repairRecordSchema.parse({
      category: "brakes",
      cost_amount: "",
      cost_currency: "USD",
      description: "",
      notes: "",
      odometer_reading: "",
      repair_date: "2026-05-02",
      title: "Brake pads",
      vehicle_id: "veh_1",
      vendor_name: "",
      warranty_until_date: "2027-05-02",
      warranty_until_odometer: "36000",
    });

    expect(valid.warranty_until_odometer).toBe(36000);

    expect(
      repairRecordSchema.safeParse({
        category: "brakes",
        cost_amount: "",
        cost_currency: "USD",
        description: "",
        notes: "",
        odometer_reading: "",
        repair_date: "2026-05-02",
        title: "Brake pads",
        vehicle_id: "veh_1",
        vendor_name: "",
        warranty_until_date: "2027-13-02",
        warranty_until_odometer: "",
      }).success,
    ).toBe(false);
  });
});

describe("maintenanceReminderSchema", () => {
  it("requires due fields that match the reminder type", () => {
    expect(
      maintenanceReminderSchema.safeParse({
        category: "oil_change",
        due_date: "",
        due_odometer: "",
        notes: "",
        reminder_type: "date",
        repeat_interval_miles: "",
        repeat_interval_months: "",
        title: "Oil change",
        vehicle_id: "veh_1",
      }).success,
    ).toBe(false);

    expect(
      maintenanceReminderSchema.safeParse({
        category: "oil_change",
        due_date: "",
        due_odometer: "",
        notes: "",
        reminder_type: "mileage",
        repeat_interval_miles: "",
        repeat_interval_months: "",
        title: "Oil change",
        vehicle_id: "veh_1",
      }).success,
    ).toBe(false);

    expect(
      maintenanceReminderSchema.parse({
        category: "oil_change",
        due_date: "2026-05-10",
        due_odometer: "30000",
        notes: "",
        reminder_type: "date_or_mileage",
        repeat_interval_miles: "",
        repeat_interval_months: "",
        title: "Oil change",
        vehicle_id: "veh_1",
      }).due_odometer,
    ).toBe(30000);
  });

  it("accepts cloud UUID vehicle ids and trims optional notes", () => {
    const parsed = maintenanceReminderSchema.parse({
      category: "registration",
      due_date: "2026-06-01",
      due_odometer: "",
      notes: " Renew online ",
      reminder_type: "date",
      repeat_interval_miles: "",
      repeat_interval_months: "12",
      title: "Registration renewal",
      vehicle_id: "65a2848e-6017-4a53-820d-88f46902785c",
    });

    expect(parsed.notes).toBe("Renew online");
    expect(parsed.repeat_interval_months).toBe(12);
    expect(parsed.vehicle_id).toBe("65a2848e-6017-4a53-820d-88f46902785c");
  });
});

describe("recordAttachmentSchema", () => {
  it("requires exactly one linked record", () => {
    const result = recordAttachmentSchema.safeParse({
      file_name: "receipt.pdf",
      file_size_bytes: "",
      file_type: "pdf",
      local_uri: "file:///receipt.pdf",
      mime_type: "application/pdf",
      repair_record_id: "",
      service_record_id: "",
      vehicle_id: "veh_1",
    });

    expect(result.success).toBe(false);
  });

  it("validates file type, MIME type, and size limits", () => {
    expect(
      recordAttachmentSchema.safeParse({
        file_name: "receipt.jpg",
        file_size_bytes: 11 * 1024 * 1024,
        file_type: "photo",
        local_uri: "file:///receipt.jpg",
        mime_type: "image/jpeg",
        repair_record_id: "",
        service_record_id: "svc_1",
        vehicle_id: "veh_1",
      }).success,
    ).toBe(false);

    expect(
      recordAttachmentSchema.safeParse({
        file_name: "receipt.pdf",
        file_size_bytes: "",
        file_type: "pdf",
        local_uri: "file:///receipt.pdf",
        mime_type: "image/jpeg",
        repair_record_id: "",
        service_record_id: "svc_1",
        vehicle_id: "veh_1",
      }).success,
    ).toBe(false);

    expect(
      recordAttachmentSchema.parse({
        file_name: "receipt.pdf",
        file_size_bytes: "",
        file_type: "pdf",
        local_uri: "file:///receipt.pdf",
        mime_type: "application/pdf",
        repair_record_id: "",
        service_record_id: "svc_1",
        vehicle_id: "veh_1",
      }).file_type,
    ).toBe("pdf");
  });
});
