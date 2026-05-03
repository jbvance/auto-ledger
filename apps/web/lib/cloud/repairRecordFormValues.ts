import type { RepairRecord, Vehicle } from "@autoledger/shared";

export type WebRepairRecordFormValues = {
  category: RepairRecord["category"];
  cost_amount: string;
  cost_currency: string;
  description: string;
  notes: string;
  odometer_reading: string;
  repair_date: string;
  title: string;
  vehicle_id: string;
  vendor_name: string;
  warranty_until_date: string;
  warranty_until_odometer: string;
};

const fieldValue = (value: null | number | string | undefined) =>
  value === null || value === undefined ? "" : `${value}`;

export const getTodayDateInputValue = (date = new Date()) =>
  date.toISOString().slice(0, 10);

export const emptyWebRepairRecordFormValues = (
  vehicle: Vehicle,
): WebRepairRecordFormValues => ({
  category: "brakes",
  cost_amount: "",
  cost_currency: "USD",
  description: "",
  notes: "",
  odometer_reading: `${vehicle.current_odometer}`,
  repair_date: getTodayDateInputValue(),
  title: "",
  vehicle_id: vehicle.id,
  vendor_name: "",
  warranty_until_date: "",
  warranty_until_odometer: "",
});

export const repairRecordToWebFormValues = (
  record: RepairRecord,
): WebRepairRecordFormValues => ({
  category: record.category,
  cost_amount: fieldValue(record.cost_amount),
  cost_currency: record.cost_currency || "USD",
  description: fieldValue(record.description),
  notes: fieldValue(record.notes),
  odometer_reading: fieldValue(record.odometer_reading),
  repair_date: record.repair_date,
  title: record.title,
  vehicle_id: record.vehicle_id,
  vendor_name: fieldValue(record.vendor_name),
  warranty_until_date: fieldValue(record.warranty_until_date),
  warranty_until_odometer: fieldValue(record.warranty_until_odometer),
});
