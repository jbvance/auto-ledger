import type { ServiceRecord, Vehicle } from "@autoledger/shared";

export type WebServiceRecordFormValues = {
  category: ServiceRecord["category"];
  cost_amount: string;
  cost_currency: string;
  description: string;
  notes: string;
  odometer_reading: string;
  service_date: string;
  title: string;
  vehicle_id: string;
  vendor_name: string;
};

const fieldValue = (value: null | number | string | undefined) =>
  value === null || value === undefined ? "" : `${value}`;

export const getTodayDateInputValue = (date = new Date()) =>
  date.toISOString().slice(0, 10);

export const emptyWebServiceRecordFormValues = (
  vehicle: Vehicle,
): WebServiceRecordFormValues => ({
  category: "oil_change",
  cost_amount: "",
  cost_currency: "USD",
  description: "",
  notes: "",
  odometer_reading: `${vehicle.current_odometer}`,
  service_date: getTodayDateInputValue(),
  title: "",
  vehicle_id: vehicle.id,
  vendor_name: "",
});

export const serviceRecordToWebFormValues = (
  record: ServiceRecord,
): WebServiceRecordFormValues => ({
  category: record.category,
  cost_amount: fieldValue(record.cost_amount),
  cost_currency: record.cost_currency || "USD",
  description: fieldValue(record.description),
  notes: fieldValue(record.notes),
  odometer_reading: fieldValue(record.odometer_reading),
  service_date: record.service_date,
  title: record.title,
  vehicle_id: record.vehicle_id,
  vendor_name: fieldValue(record.vendor_name),
});
