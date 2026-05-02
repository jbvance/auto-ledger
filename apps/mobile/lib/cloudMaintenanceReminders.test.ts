import { mapCloudMaintenanceReminderRow } from "./cloudMaintenanceReminders";
import type { CloudMaintenanceReminderRow } from "./cloudMaintenanceReminders";

describe("cloud maintenance reminder mapping", () => {
  it("maps Supabase reminder rows into app reminder types", () => {
    const row: CloudMaintenanceReminderRow = {
      category: "oil_change",
      completed_at: null,
      created_at: "2026-05-01T00:00:00.000Z",
      due_date: "2026-05-15",
      due_odometer: 30000,
      id: "7a42d8c9-f2b3-4aa8-b9a2-cc2f0165f9f1",
      is_completed: false,
      last_triggered_at: null,
      local_id: "cloud_rem_1",
      notes: null,
      reminder_type: "date_or_mileage",
      repeat_interval_miles: 5000,
      repeat_interval_months: 6,
      scheduled_notification_id: null,
      sync_status: "synced",
      title: "Oil change",
      updated_at: "2026-05-01T00:00:00.000Z",
      user_id: "0e85579d-86ac-4d1b-9a53-8f89e91d2d25",
      vehicle_id: "65a2848e-6017-4a53-820d-88f46902785c",
    };

    expect(mapCloudMaintenanceReminderRow(row)).toMatchObject({
      category: "oil_change",
      reminder_type: "date_or_mileage",
      sync_status: "synced",
      title: "Oil change",
    });
  });
});
