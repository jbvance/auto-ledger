import { describe, expect, it } from "vitest";

import {
  buildCsv,
  buildVehicleHistoryItems,
  escapeCsvValue,
  exportCombinedLocalCsv,
  formatCostAmount,
  formatDisplayDate,
  formatOdometer,
  getMaintenanceReminderStatus,
  getRecalculatedVehicleOdometer,
  type LocalCsvExportData,
  type MaintenanceReminder,
  type OdometerEntry,
  type RepairRecord,
  type ServiceRecord,
  type Vehicle,
} from "./index";

const vehicle: Vehicle = {
  archived_at: null,
  color: null,
  created_at: "2026-01-01T00:00:00.000Z",
  current_odometer: 25000,
  id: "veh_1",
  initial_odometer: 10000,
  license_plate: null,
  license_state: null,
  local_id: "veh_1",
  make: "Honda",
  model: "CR-V",
  nickname: "Family car",
  notes: null,
  odometer_unit: "mi",
  purchase_date: null,
  purchase_odometer: null,
  sync_status: "local_only",
  trim: "EX",
  updated_at: "2026-01-02T00:00:00.000Z",
  vehicle_type: "suv",
  vin: null,
  year: 2020,
};

const reminderBase: MaintenanceReminder = {
  category: "oil_change",
  completed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  due_date: null,
  due_odometer: null,
  id: "rem_1",
  is_completed: false,
  last_triggered_at: null,
  local_id: "rem_1",
  notes: null,
  reminder_type: "date",
  repeat_interval_miles: null,
  repeat_interval_months: null,
  scheduled_notification_id: null,
  sync_status: "local_only",
  title: "Oil change",
  updated_at: "2026-01-01T00:00:00.000Z",
  vehicle_id: vehicle.id,
};

describe("CSV helpers", () => {
  it("escapes commas, quotes, newlines, and empty values", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue("plain")).toBe("plain");
    expect(escapeCsvValue("ACME, Inc.")).toBe('"ACME, Inc."');
    expect(escapeCsvValue('He said "go"')).toBe('"He said ""go"""');
    expect(escapeCsvValue("line one\nline two")).toBe('"line one\nline two"');
  });

  it("builds a header row and escaped data rows", () => {
    const csv = buildCsv(
      [
        { header: "name", value: (row: { name: string }) => row.name },
        { header: "notes", value: (row: { notes?: string }) => row.notes },
      ],
      [{ name: "Family car", notes: "oil, tires" }],
    );

    expect(csv).toBe('name,notes\nFamily car,"oil, tires"');
  });

  it("exports local data into the combined CSV shape", () => {
    const data: LocalCsvExportData = {
      maintenanceReminders: [{ ...reminderBase, due_date: "2026-05-10" }],
      odometerEntries: [],
      recordAttachments: [],
      repairRecords: [],
      serviceRecords: [],
      vehicles: [vehicle],
    };
    const csv = exportCombinedLocalCsv(data);

    expect(csv).toContain("dataset,id,vehicle_id");
    expect(csv).toContain("vehicles,veh_1,veh_1");
    expect(csv).toContain("maintenance_reminders,rem_1,veh_1");
  });
});

describe("reminder status", () => {
  it("marks completed reminders as completed", () => {
    expect(
      getMaintenanceReminderStatus({
        currentOdometer: 100,
        reminder: { ...reminderBase, is_completed: true },
        today: "2026-05-01",
      }),
    ).toBe("completed");
  });

  it("calculates date-based overdue, due soon, and upcoming states", () => {
    expect(
      getMaintenanceReminderStatus({
        currentOdometer: 100,
        reminder: { ...reminderBase, due_date: "2026-04-30" },
        today: "2026-05-01",
      }),
    ).toBe("overdue");

    expect(
      getMaintenanceReminderStatus({
        currentOdometer: 100,
        reminder: { ...reminderBase, due_date: "2026-05-10" },
        today: "2026-05-01",
      }),
    ).toBe("due_soon");

    expect(
      getMaintenanceReminderStatus({
        currentOdometer: 100,
        reminder: { ...reminderBase, due_date: "2026-06-01" },
        today: "2026-05-01",
      }),
    ).toBe("upcoming");
  });

  it("uses mileage thresholds for mileage and date-or-mileage reminders", () => {
    expect(
      getMaintenanceReminderStatus({
        currentOdometer: 25000,
        reminder: {
          ...reminderBase,
          due_odometer: 25000,
          reminder_type: "mileage",
        },
      }),
    ).toBe("overdue");

    expect(
      getMaintenanceReminderStatus({
        currentOdometer: 24550,
        reminder: {
          ...reminderBase,
          due_odometer: 25000,
          reminder_type: "date_or_mileage",
        },
      }),
    ).toBe("due_soon");
  });
});

describe("odometer recalculation helper", () => {
  it("uses the highest reading from entries and records without dropping below initial odometer", () => {
    expect(
      getRecalculatedVehicleOdometer({
        initialOdometer: 10000,
        odometerEntryReadings: [12000, 18000],
        repairRecordReadings: [17000],
        serviceRecordReadings: [21000, null],
      }),
    ).toBe(21000);

    expect(
      getRecalculatedVehicleOdometer({
        initialOdometer: 10000,
        odometerEntryReadings: [9000],
      }),
    ).toBe(10000);
  });

  it("can preserve the current cloud odometer during record creation", () => {
    expect(
      getRecalculatedVehicleOdometer({
        currentOdometer: 32000,
        initialOdometer: 10000,
        odometerEntryReadings: [24000],
        preserveCurrent: true,
        purchaseOdometer: 12000,
      }),
    ).toBe(32000);
  });
});

describe("formatting and history helpers", () => {
  it("formats common vehicle values for display", () => {
    expect(formatOdometer(12345, "mi")).toBe("12,345 mi");
    expect(formatDisplayDate("2026-05-02")).toBe("May 2, 2026");
    expect(formatCostAmount(123.4)).toBe("$123.40");
  });

  it("builds a reverse-chronological vehicle history", () => {
    const odometerEntry: OdometerEntry = {
      created_at: "2026-01-01T00:00:00.000Z",
      id: "odo_1",
      local_id: "odo_1",
      notes: null,
      odometer_unit: "mi",
      reading: 20000,
      reading_date: "2026-01-15",
      source_type: "manual",
      sync_status: "local_only",
      updated_at: "2026-01-01T00:00:00.000Z",
      vehicle_id: vehicle.id,
    };
    const serviceRecord: ServiceRecord = {
      category: "oil_change",
      cost_amount: 89.99,
      cost_currency: "USD",
      created_at: "2026-02-01T00:00:00.000Z",
      description: null,
      id: "svc_1",
      local_id: "svc_1",
      notes: null,
      odometer_reading: 21000,
      service_date: "2026-02-01",
      sync_status: "local_only",
      title: "Oil change",
      updated_at: "2026-02-01T00:00:00.000Z",
      vehicle_id: vehicle.id,
      vendor_name: "Local Shop",
    };
    const repairRecord: RepairRecord = {
      category: "brakes",
      cost_amount: 450,
      cost_currency: "USD",
      created_at: "2026-01-20T00:00:00.000Z",
      description: null,
      id: "rep_1",
      local_id: "rep_1",
      notes: null,
      odometer_reading: 20500,
      repair_date: "2026-01-20",
      sync_status: "local_only",
      title: "Brake pads",
      updated_at: "2026-01-20T00:00:00.000Z",
      vehicle_id: vehicle.id,
      vendor_name: null,
      warranty_until_date: null,
      warranty_until_odometer: null,
    };

    const history = buildVehicleHistoryItems({
      odometerEntries: [odometerEntry],
      repairRecords: [repairRecord],
      serviceRecords: [serviceRecord],
    });

    expect(history.map((item) => item.id)).toEqual(["svc_1", "rep_1", "odo_1"]);
  });
});
