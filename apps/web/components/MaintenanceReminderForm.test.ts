import { describe, expect, it } from "vitest";

import {
  emptyWebMaintenanceReminderFormValues,
  maintenanceReminderToWebFormValues,
} from "../lib/cloud/maintenanceReminderFormValues";

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

describe("web maintenance reminder form helpers", () => {
  it("defaults new reminders to date-or-mileage and empty due fields", () => {
    expect(emptyWebMaintenanceReminderFormValues(vehicle)).toEqual({
      category: "oil_change",
      due_date: "",
      due_odometer: "",
      notes: "",
      reminder_type: "date_or_mileage",
      repeat_interval_miles: "",
      repeat_interval_months: "",
      title: "",
      vehicle_id: "vehicle-1",
    });
  });

  it("maps an existing reminder into editable form values", () => {
    expect(
      maintenanceReminderToWebFormValues({
        category: "registration",
        completed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        due_date: "2026-05-01",
        due_odometer: null,
        id: "reminder-1",
        is_completed: false,
        last_triggered_at: null,
        local_id: "cloud_rem_1",
        notes: "Renew online",
        reminder_type: "date",
        repeat_interval_miles: null,
        repeat_interval_months: 12,
        scheduled_notification_id: null,
        sync_status: "synced",
        title: "Registration renewal",
        updated_at: "2026-01-02T00:00:00.000Z",
        vehicle_id: "vehicle-1",
      }),
    ).toEqual({
      category: "registration",
      due_date: "2026-05-01",
      due_odometer: "",
      notes: "Renew online",
      reminder_type: "date",
      repeat_interval_miles: "",
      repeat_interval_months: "12",
      title: "Registration renewal",
      vehicle_id: "vehicle-1",
    });
  });
});
