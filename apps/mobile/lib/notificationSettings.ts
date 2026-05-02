import { getGuestDatabase } from "./database";

const notificationSettingsId = "local";

export type ReminderNotificationSettings = {
  reminder_notifications_enabled: boolean;
  days_before_due_date: number;
  miles_before_due_odometer: number;
  updated_at: string;
};

type ReminderNotificationSettingsRow = Omit<
  ReminderNotificationSettings,
  "reminder_notifications_enabled"
> & {
  reminder_notifications_enabled: number;
};

export type ReminderNotificationSettingsInput = Partial<
  Pick<
    ReminderNotificationSettings,
    | "reminder_notifications_enabled"
    | "days_before_due_date"
    | "miles_before_due_odometer"
  >
>;

const clampWholeNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.trunc(value), min), max);

const mapSettingsRow = (
  row: ReminderNotificationSettingsRow,
): ReminderNotificationSettings => ({
  days_before_due_date: row.days_before_due_date,
  miles_before_due_odometer: row.miles_before_due_odometer,
  reminder_notifications_enabled: Boolean(row.reminder_notifications_enabled),
  updated_at: row.updated_at,
});

export const getReminderNotificationSettings =
  async (): Promise<ReminderNotificationSettings> => {
    const db = await getGuestDatabase();
    const row = await db.getFirstAsync<ReminderNotificationSettingsRow>(
      `SELECT reminder_notifications_enabled,
              days_before_due_date,
              miles_before_due_odometer,
              updated_at
       FROM notification_settings
       WHERE id = ?
       LIMIT 1`,
      notificationSettingsId,
    );

    if (!row) {
      const now = new Date().toISOString();

      return {
        days_before_due_date: 3,
        miles_before_due_odometer: 500,
        reminder_notifications_enabled: false,
        updated_at: now,
      };
    }

    return mapSettingsRow(row);
  };

export const updateReminderNotificationSettings = async (
  input: ReminderNotificationSettingsInput,
) => {
  const existing = await getReminderNotificationSettings();
  const db = await getGuestDatabase();
  const updated: ReminderNotificationSettings = {
    days_before_due_date:
      input.days_before_due_date === undefined
        ? existing.days_before_due_date
        : clampWholeNumber(input.days_before_due_date, 0, 30),
    miles_before_due_odometer:
      input.miles_before_due_odometer === undefined
        ? existing.miles_before_due_odometer
        : clampWholeNumber(input.miles_before_due_odometer, 0, 10000),
    reminder_notifications_enabled:
      input.reminder_notifications_enabled ??
      existing.reminder_notifications_enabled,
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE notification_settings
     SET reminder_notifications_enabled = ?,
         days_before_due_date = ?,
         miles_before_due_odometer = ?,
         updated_at = ?
     WHERE id = ?`,
    updated.reminder_notifications_enabled ? 1 : 0,
    updated.days_before_due_date,
    updated.miles_before_due_odometer,
    updated.updated_at,
    notificationSettingsId,
  );

  return updated;
};
