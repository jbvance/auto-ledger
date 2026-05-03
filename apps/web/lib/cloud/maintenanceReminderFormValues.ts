import type { MaintenanceReminder, Vehicle } from "@autoledger/shared";

export type WebMaintenanceReminderFormValues = {
  category: MaintenanceReminder["category"];
  due_date: string;
  due_odometer: string;
  notes: string;
  reminder_type: MaintenanceReminder["reminder_type"];
  repeat_interval_miles: string;
  repeat_interval_months: string;
  title: string;
  vehicle_id: string;
};

const fieldValue = (value: null | number | string | undefined) =>
  value === null || value === undefined ? "" : `${value}`;

export const emptyWebMaintenanceReminderFormValues = (
  vehicle: Vehicle,
): WebMaintenanceReminderFormValues => ({
  category: "oil_change",
  due_date: "",
  due_odometer: "",
  notes: "",
  reminder_type: "date_or_mileage",
  repeat_interval_miles: "",
  repeat_interval_months: "",
  title: "",
  vehicle_id: vehicle.id,
});

export const maintenanceReminderToWebFormValues = (
  reminder: MaintenanceReminder,
): WebMaintenanceReminderFormValues => ({
  category: reminder.category,
  due_date: fieldValue(reminder.due_date),
  due_odometer: fieldValue(reminder.due_odometer),
  notes: fieldValue(reminder.notes),
  reminder_type: reminder.reminder_type,
  repeat_interval_miles: fieldValue(reminder.repeat_interval_miles),
  repeat_interval_months: fieldValue(reminder.repeat_interval_months),
  title: reminder.title,
  vehicle_id: reminder.vehicle_id,
});
