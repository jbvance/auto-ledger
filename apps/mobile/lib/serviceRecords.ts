import type { ServiceRecord, ServiceRecordInput } from "@autoledger/shared";

import { bindOptional, createLocalId, getGuestDatabase } from "./database";
import { deleteAttachmentsForServiceRecord } from "./recordAttachments";
import { recalculateVehicleOdometer } from "./vehicleOdometer";
import { getVehicle } from "./vehicles";

type ServiceRecordRow = Omit<ServiceRecord, "category"> & {
  category: string;
};

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapServiceRecordRow = (row: ServiceRecordRow): ServiceRecord => ({
  ...row,
  category: row.category as ServiceRecord["category"],
  sync_status: row.sync_status as ServiceRecord["sync_status"],
});

const assertServiceRecordVehicle = async (input: ServiceRecordInput) => {
  const vehicle = await getVehicle(input.vehicle_id);

  if (!vehicle) {
    throw new Error("Vehicle not found.");
  }

  return vehicle;
};

export const listServiceRecords = async (
  vehicleId: string,
): Promise<ServiceRecord[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<ServiceRecordRow>(
    `SELECT * FROM service_records
     WHERE vehicle_id = ?
     ORDER BY service_date DESC, created_at DESC`,
    vehicleId,
  );

  return rows.map(mapServiceRecordRow);
};

export const listAllServiceRecords = async (): Promise<ServiceRecord[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<ServiceRecordRow>(
    `SELECT * FROM service_records
     ORDER BY service_date DESC, created_at DESC`,
  );

  return rows.map(mapServiceRecordRow);
};

export const getServiceRecord = async (
  id: string,
): Promise<ServiceRecord | null> => {
  const db = await getGuestDatabase();
  const row = await db.getFirstAsync<ServiceRecordRow>(
    `SELECT * FROM service_records
     WHERE id = ?
     LIMIT 1`,
    id,
  );

  return row ? mapServiceRecordRow(row) : null;
};

export const createServiceRecord = async (
  input: ServiceRecordInput,
): Promise<ServiceRecord> => {
  await assertServiceRecordVehicle(input);

  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const id = createLocalId("svc");
  const record: ServiceRecord = {
    id,
    local_id: id,
    vehicle_id: input.vehicle_id,
    service_date: input.service_date,
    odometer_reading: optionalNumber(input.odometer_reading),
    title: input.title,
    category: input.category,
    description: optionalText(input.description),
    vendor_name: optionalText(input.vendor_name),
    cost_amount: optionalNumber(input.cost_amount),
    cost_currency: input.cost_currency || "USD",
    notes: optionalText(input.notes),
    created_at: now,
    updated_at: now,
    sync_status: "local_only",
  };

  await db.runAsync(
    `INSERT INTO service_records (
      id,
      local_id,
      vehicle_id,
      service_date,
      odometer_reading,
      title,
      category,
      description,
      vendor_name,
      cost_amount,
      cost_currency,
      notes,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.local_id,
      record.vehicle_id,
      record.service_date,
      bindOptional(record.odometer_reading),
      record.title,
      record.category,
      bindOptional(record.description),
      bindOptional(record.vendor_name),
      bindOptional(record.cost_amount),
      record.cost_currency,
      bindOptional(record.notes),
      record.created_at,
      record.updated_at,
      record.sync_status,
    ],
  );

  await recalculateVehicleOdometer(record.vehicle_id);

  return record;
};

export const updateServiceRecord = async (
  id: string,
  input: ServiceRecordInput,
): Promise<ServiceRecord | null> => {
  const existing = await getServiceRecord(id);

  if (!existing) {
    return null;
  }

  await assertServiceRecordVehicle(input);

  const db = await getGuestDatabase();
  const updated: ServiceRecord = {
    ...existing,
    ...input,
    odometer_reading: optionalNumber(input.odometer_reading),
    description: optionalText(input.description),
    vendor_name: optionalText(input.vendor_name),
    cost_amount: optionalNumber(input.cost_amount),
    cost_currency: input.cost_currency || "USD",
    notes: optionalText(input.notes),
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE service_records
     SET vehicle_id = ?,
         service_date = ?,
         odometer_reading = ?,
         title = ?,
         category = ?,
         description = ?,
         vendor_name = ?,
         cost_amount = ?,
         cost_currency = ?,
         notes = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      updated.vehicle_id,
      updated.service_date,
      bindOptional(updated.odometer_reading),
      updated.title,
      updated.category,
      bindOptional(updated.description),
      bindOptional(updated.vendor_name),
      bindOptional(updated.cost_amount),
      updated.cost_currency,
      bindOptional(updated.notes),
      updated.updated_at,
      id,
    ],
  );

  await recalculateVehicleOdometer(existing.vehicle_id);

  if (existing.vehicle_id !== updated.vehicle_id) {
    await recalculateVehicleOdometer(updated.vehicle_id);
  }

  return updated;
};

export const deleteServiceRecord = async (id: string): Promise<void> => {
  const existing = await getServiceRecord(id);

  if (!existing) {
    return;
  }

  const db = await getGuestDatabase();
  await deleteAttachmentsForServiceRecord(id);
  await db.runAsync(`DELETE FROM service_records WHERE id = ?`, id);
  await recalculateVehicleOdometer(existing.vehicle_id);
};
