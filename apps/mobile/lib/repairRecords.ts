import type { RepairRecord, RepairRecordInput } from "@autoledger/shared";

import { bindOptional, createLocalId, getGuestDatabase } from "./database";
import { deleteAttachmentsForRepairRecord } from "./recordAttachments";
import { recalculateVehicleOdometer } from "./vehicleOdometer";
import { getVehicle } from "./vehicles";

type RepairRecordRow = Omit<RepairRecord, "category"> & {
  category: string;
};

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapRepairRecordRow = (row: RepairRecordRow): RepairRecord => ({
  ...row,
  category: row.category as RepairRecord["category"],
  sync_status: row.sync_status as RepairRecord["sync_status"],
});

const assertRepairRecordVehicle = async (input: RepairRecordInput) => {
  const vehicle = await getVehicle(input.vehicle_id);

  if (!vehicle) {
    throw new Error("Vehicle not found.");
  }

  return vehicle;
};

export const listRepairRecords = async (
  vehicleId: string,
): Promise<RepairRecord[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<RepairRecordRow>(
    `SELECT * FROM repair_records
     WHERE vehicle_id = ?
     ORDER BY repair_date DESC, created_at DESC`,
    vehicleId,
  );

  return rows.map(mapRepairRecordRow);
};

export const getRepairRecord = async (
  id: string,
): Promise<RepairRecord | null> => {
  const db = await getGuestDatabase();
  const row = await db.getFirstAsync<RepairRecordRow>(
    `SELECT * FROM repair_records
     WHERE id = ?
     LIMIT 1`,
    id,
  );

  return row ? mapRepairRecordRow(row) : null;
};

export const createRepairRecord = async (
  input: RepairRecordInput,
): Promise<RepairRecord> => {
  await assertRepairRecordVehicle(input);

  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const id = createLocalId("rep");
  const record: RepairRecord = {
    id,
    local_id: id,
    vehicle_id: input.vehicle_id,
    repair_date: input.repair_date,
    odometer_reading: optionalNumber(input.odometer_reading),
    title: input.title,
    category: input.category,
    description: optionalText(input.description),
    vendor_name: optionalText(input.vendor_name),
    cost_amount: optionalNumber(input.cost_amount),
    cost_currency: input.cost_currency || "USD",
    warranty_until_date: optionalText(input.warranty_until_date),
    warranty_until_odometer: optionalNumber(input.warranty_until_odometer),
    notes: optionalText(input.notes),
    created_at: now,
    updated_at: now,
    sync_status: "local_only",
  };

  await db.runAsync(
    `INSERT INTO repair_records (
      id,
      local_id,
      vehicle_id,
      repair_date,
      odometer_reading,
      title,
      category,
      description,
      vendor_name,
      cost_amount,
      cost_currency,
      warranty_until_date,
      warranty_until_odometer,
      notes,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.local_id,
      record.vehicle_id,
      record.repair_date,
      bindOptional(record.odometer_reading),
      record.title,
      record.category,
      bindOptional(record.description),
      bindOptional(record.vendor_name),
      bindOptional(record.cost_amount),
      record.cost_currency,
      bindOptional(record.warranty_until_date),
      bindOptional(record.warranty_until_odometer),
      bindOptional(record.notes),
      record.created_at,
      record.updated_at,
      record.sync_status,
    ],
  );

  await recalculateVehicleOdometer(record.vehicle_id);

  return record;
};

export const updateRepairRecord = async (
  id: string,
  input: RepairRecordInput,
): Promise<RepairRecord | null> => {
  const existing = await getRepairRecord(id);

  if (!existing) {
    return null;
  }

  await assertRepairRecordVehicle(input);

  const db = await getGuestDatabase();
  const updated: RepairRecord = {
    ...existing,
    ...input,
    odometer_reading: optionalNumber(input.odometer_reading),
    description: optionalText(input.description),
    vendor_name: optionalText(input.vendor_name),
    cost_amount: optionalNumber(input.cost_amount),
    cost_currency: input.cost_currency || "USD",
    warranty_until_date: optionalText(input.warranty_until_date),
    warranty_until_odometer: optionalNumber(input.warranty_until_odometer),
    notes: optionalText(input.notes),
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE repair_records
     SET vehicle_id = ?,
         repair_date = ?,
         odometer_reading = ?,
         title = ?,
         category = ?,
         description = ?,
         vendor_name = ?,
         cost_amount = ?,
         cost_currency = ?,
         warranty_until_date = ?,
         warranty_until_odometer = ?,
         notes = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      updated.vehicle_id,
      updated.repair_date,
      bindOptional(updated.odometer_reading),
      updated.title,
      updated.category,
      bindOptional(updated.description),
      bindOptional(updated.vendor_name),
      bindOptional(updated.cost_amount),
      updated.cost_currency,
      bindOptional(updated.warranty_until_date),
      bindOptional(updated.warranty_until_odometer),
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

export const deleteRepairRecord = async (id: string): Promise<void> => {
  const existing = await getRepairRecord(id);

  if (!existing) {
    return;
  }

  const db = await getGuestDatabase();
  await deleteAttachmentsForRepairRecord(id);
  await db.runAsync(`DELETE FROM repair_records WHERE id = ?`, id);
  await recalculateVehicleOdometer(existing.vehicle_id);
};
