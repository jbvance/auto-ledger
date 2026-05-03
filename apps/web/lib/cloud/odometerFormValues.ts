import type { OdometerEntry, Vehicle } from "@autoledger/shared";

export type WebOdometerEntryFormValues = {
  notes: string;
  odometer_unit: Vehicle["odometer_unit"];
  reading: string;
  reading_date: string;
  source_type: "manual";
  vehicle_id: string;
};

const fieldValue = (value: null | number | string | undefined) =>
  value === null || value === undefined ? "" : `${value}`;

export const getTodayDateInputValue = (date = new Date()) =>
  date.toISOString().slice(0, 10);

export const emptyWebOdometerEntryFormValues = (
  vehicle: Vehicle,
): WebOdometerEntryFormValues => ({
  notes: "",
  odometer_unit: vehicle.odometer_unit,
  reading: "",
  reading_date: getTodayDateInputValue(),
  source_type: "manual",
  vehicle_id: vehicle.id,
});

export const odometerEntryToWebFormValues = (
  entry: OdometerEntry,
): WebOdometerEntryFormValues => ({
  notes: fieldValue(entry.notes),
  odometer_unit: entry.odometer_unit,
  reading: `${entry.reading}`,
  reading_date: entry.reading_date,
  source_type: "manual",
  vehicle_id: entry.vehicle_id,
});
