import {
  compareMaintenanceRemindersByUrgency,
  type MaintenanceReminder,
  type MaintenanceReminderInput,
} from "@autoledger/shared";

import { bindOptional, createLocalId, getGuestDatabase } from "./database";
import { getReminderNotificationSettings } from "./notificationSettings";
import {
  cancelLocalNotification,
  scheduleLocalReminderNotification,
} from "./notifications";
import { getVehicle, listVehicles } from "./vehicles";

type MaintenanceReminderRow = Omit<
  MaintenanceReminder,
  "category" | "is_completed" | "reminder_type"
> & {
  category: string;
  is_completed: number;
  reminder_type: string;
};

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapMaintenanceReminderRow = (
  row: MaintenanceReminderRow,
): MaintenanceReminder => ({
  ...row,
  category: row.category as MaintenanceReminder["category"],
  is_completed: Boolean(row.is_completed),
  reminder_type: row.reminder_type as MaintenanceReminder["reminder_type"],
  sync_status: row.sync_status as MaintenanceReminder["sync_status"],
});

const assertReminderVehicle = async (input: MaintenanceReminderInput) => {
  const vehicle = await getVehicle(input.vehicle_id);

  if (!vehicle) {
    throw new Error("Vehicle not found.");
  }

  return vehicle;
};

const updateScheduledNotificationId = async (
  reminderId: string,
  scheduledNotificationId: string | null,
) => {
  const db = await getGuestDatabase();

  await db.runAsync(
    `UPDATE maintenance_reminders
     SET scheduled_notification_id = ?,
         updated_at = ?
     WHERE id = ?`,
    bindOptional(scheduledNotificationId),
    new Date().toISOString(),
    reminderId,
  );
};

const warnNotificationSyncError = (error: unknown) => {
  console.warn("Unable to sync local reminder notification.", error);
};

const syncReminderNotificationAfterSave = async (reminderId: string) => {
  try {
    await rescheduleMaintenanceReminderNotification(reminderId);
  } catch (error: unknown) {
    warnNotificationSyncError(error);
  }
};

const sortReminders = async (reminders: MaintenanceReminder[]) => {
  const vehicles = await listVehicles();
  const vehicleOdometers = Object.fromEntries(
    vehicles.map((vehicle) => [vehicle.id, vehicle.current_odometer]),
  );

  return reminders.sort((first, second) =>
    compareMaintenanceRemindersByUrgency(first, second, vehicleOdometers),
  );
};

export const listMaintenanceReminders = async (
  vehicleId: string,
): Promise<MaintenanceReminder[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<MaintenanceReminderRow>(
    `SELECT * FROM maintenance_reminders
     WHERE vehicle_id = ?
     ORDER BY is_completed ASC, due_date ASC, due_odometer ASC, created_at DESC`,
    vehicleId,
  );

  return sortReminders(rows.map(mapMaintenanceReminderRow));
};

export const listAllActiveMaintenanceReminders = async (): Promise<
  MaintenanceReminder[]
> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<MaintenanceReminderRow>(
    `SELECT maintenance_reminders.*
     FROM maintenance_reminders
     INNER JOIN vehicles ON vehicles.id = maintenance_reminders.vehicle_id
     WHERE maintenance_reminders.is_completed = 0
       AND vehicles.archived_at IS NULL
     ORDER BY due_date ASC, due_odometer ASC, maintenance_reminders.created_at DESC`,
  );

  return sortReminders(rows.map(mapMaintenanceReminderRow));
};

export const getMaintenanceReminder = async (
  id: string,
): Promise<MaintenanceReminder | null> => {
  const db = await getGuestDatabase();
  const row = await db.getFirstAsync<MaintenanceReminderRow>(
    `SELECT * FROM maintenance_reminders
     WHERE id = ?
     LIMIT 1`,
    id,
  );

  return row ? mapMaintenanceReminderRow(row) : null;
};

export const rescheduleMaintenanceReminderNotification = async (
  id: string,
): Promise<void> => {
  const reminder = await getMaintenanceReminder(id);

  if (!reminder) {
    return;
  }

  await cancelLocalNotification(reminder.scheduled_notification_id);

  const settings = await getReminderNotificationSettings();

  if (
    !settings.reminder_notifications_enabled ||
    reminder.is_completed ||
    !reminder.due_date
  ) {
    // Pure mileage reminders cannot be scheduled locally because the app does
    // not run background mileage polling. Their status remains in-app only.
    await updateScheduledNotificationId(reminder.id, null);
    return;
  }

  const vehicle = await getVehicle(reminder.vehicle_id);

  if (!vehicle) {
    await updateScheduledNotificationId(reminder.id, null);
    return;
  }

  const result = await scheduleLocalReminderNotification({
    daysBeforeDueDate: settings.days_before_due_date,
    notificationsEnabled: settings.reminder_notifications_enabled,
    reminder,
    vehicle,
  });

  await updateScheduledNotificationId(
    reminder.id,
    result.status === "scheduled" ? result.notificationId : null,
  );
};

export const rescheduleActiveReminderNotifications =
  async (): Promise<void> => {
    const reminders = await listAllActiveMaintenanceReminders();

    await Promise.all(
      reminders.map((reminder) =>
        rescheduleMaintenanceReminderNotification(reminder.id),
      ),
    );
  };

export const cancelAllScheduledReminderNotifications =
  async (): Promise<void> => {
    const db = await getGuestDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      scheduled_notification_id: string | null;
    }>(
      `SELECT id, scheduled_notification_id
       FROM maintenance_reminders
       WHERE scheduled_notification_id IS NOT NULL`,
    );

    await Promise.all(
      rows.map(async (row) => {
        await cancelLocalNotification(row.scheduled_notification_id);
        await updateScheduledNotificationId(row.id, null);
      }),
    );
  };

export const createMaintenanceReminder = async (
  input: MaintenanceReminderInput,
): Promise<MaintenanceReminder> => {
  await assertReminderVehicle(input);

  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const id = createLocalId("rem");
  const reminder: MaintenanceReminder = {
    id,
    local_id: id,
    vehicle_id: input.vehicle_id,
    title: input.title,
    category: input.category,
    reminder_type: input.reminder_type,
    due_date: optionalText(input.due_date),
    due_odometer: optionalNumber(input.due_odometer),
    repeat_interval_months: optionalNumber(input.repeat_interval_months),
    repeat_interval_miles: optionalNumber(input.repeat_interval_miles),
    is_completed: false,
    completed_at: null,
    last_triggered_at: null,
    notes: optionalText(input.notes),
    scheduled_notification_id: null,
    created_at: now,
    updated_at: now,
    sync_status: "local_only",
  };

  await db.runAsync(
    `INSERT INTO maintenance_reminders (
      id,
      local_id,
      vehicle_id,
      title,
      category,
      reminder_type,
      due_date,
      due_odometer,
      repeat_interval_months,
      repeat_interval_miles,
      is_completed,
      completed_at,
      last_triggered_at,
      notes,
      scheduled_notification_id,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reminder.id,
      reminder.local_id,
      reminder.vehicle_id,
      reminder.title,
      reminder.category,
      reminder.reminder_type,
      bindOptional(reminder.due_date),
      bindOptional(reminder.due_odometer),
      bindOptional(reminder.repeat_interval_months),
      bindOptional(reminder.repeat_interval_miles),
      reminder.is_completed ? 1 : 0,
      bindOptional(reminder.completed_at),
      bindOptional(reminder.last_triggered_at),
      bindOptional(reminder.notes),
      bindOptional(reminder.scheduled_notification_id),
      reminder.created_at,
      reminder.updated_at,
      reminder.sync_status,
    ],
  );

  await syncReminderNotificationAfterSave(reminder.id);

  return (await getMaintenanceReminder(reminder.id)) ?? reminder;
};

export const updateMaintenanceReminder = async (
  id: string,
  input: MaintenanceReminderInput,
): Promise<MaintenanceReminder | null> => {
  const existing = await getMaintenanceReminder(id);

  if (!existing) {
    return null;
  }

  await assertReminderVehicle(input);

  const db = await getGuestDatabase();
  const updated: MaintenanceReminder = {
    ...existing,
    ...input,
    due_date: optionalText(input.due_date),
    due_odometer: optionalNumber(input.due_odometer),
    repeat_interval_months: optionalNumber(input.repeat_interval_months),
    repeat_interval_miles: optionalNumber(input.repeat_interval_miles),
    notes: optionalText(input.notes),
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE maintenance_reminders
     SET vehicle_id = ?,
         title = ?,
         category = ?,
         reminder_type = ?,
         due_date = ?,
         due_odometer = ?,
         repeat_interval_months = ?,
         repeat_interval_miles = ?,
         notes = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      updated.vehicle_id,
      updated.title,
      updated.category,
      updated.reminder_type,
      bindOptional(updated.due_date),
      bindOptional(updated.due_odometer),
      bindOptional(updated.repeat_interval_months),
      bindOptional(updated.repeat_interval_miles),
      bindOptional(updated.notes),
      updated.updated_at,
      id,
    ],
  );

  await syncReminderNotificationAfterSave(updated.id);

  return (await getMaintenanceReminder(updated.id)) ?? updated;
};

export const completeMaintenanceReminder = async (
  id: string,
): Promise<void> => {
  const existing = await getMaintenanceReminder(id);
  const db = await getGuestDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE maintenance_reminders
     SET is_completed = 1,
         completed_at = ?,
         scheduled_notification_id = NULL,
         updated_at = ?
     WHERE id = ?`,
    now,
    now,
    id,
  );

  await cancelLocalNotification(existing?.scheduled_notification_id);
};

export const deleteMaintenanceReminder = async (id: string): Promise<void> => {
  const existing = await getMaintenanceReminder(id);
  const db = await getGuestDatabase();

  await db.runAsync(`DELETE FROM maintenance_reminders WHERE id = ?`, id);
  await cancelLocalNotification(existing?.scheduled_notification_id);
};
