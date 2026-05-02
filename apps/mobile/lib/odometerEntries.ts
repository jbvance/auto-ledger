import type { OdometerEntry, OdometerEntryInput } from "@autoledger/shared";

import { bindOptional, createLocalId, getGuestDatabase } from "./database";
import { recalculateVehicleOdometer } from "./vehicleOdometer";
import { getVehicle } from "./vehicles";

type OdometerEntryRow = Omit<OdometerEntry, "odometer_unit" | "source_type"> & {
  odometer_unit: string;
  source_type: string;
};

const optionalText = (value: string | null | undefined) => value ?? null;

const mapOdometerEntryRow = (row: OdometerEntryRow): OdometerEntry => ({
  ...row,
  odometer_unit: row.odometer_unit as OdometerEntry["odometer_unit"],
  source_type: row.source_type as OdometerEntry["source_type"],
  sync_status: row.sync_status as OdometerEntry["sync_status"],
});

const assertEntryMatchesVehicle = async (input: OdometerEntryInput) => {
  const vehicle = await getVehicle(input.vehicle_id);

  if (!vehicle) {
    throw new Error("Vehicle not found.");
  }

  if (input.odometer_unit !== vehicle.odometer_unit) {
    throw new Error("Odometer unit must match the vehicle.");
  }

  return vehicle;
};

export const listOdometerEntries = async (
  vehicleId: string,
): Promise<OdometerEntry[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<OdometerEntryRow>(
    `SELECT * FROM odometer_entries
     WHERE vehicle_id = ?
     ORDER BY reading_date DESC, created_at DESC`,
    vehicleId,
  );

  return rows.map(mapOdometerEntryRow);
};

export const getOdometerEntry = async (
  id: string,
): Promise<OdometerEntry | null> => {
  const db = await getGuestDatabase();
  const row = await db.getFirstAsync<OdometerEntryRow>(
    `SELECT * FROM odometer_entries
     WHERE id = ?
     LIMIT 1`,
    id,
  );

  return row ? mapOdometerEntryRow(row) : null;
};

export const createOdometerEntry = async (
  input: OdometerEntryInput,
): Promise<OdometerEntry> => {
  await assertEntryMatchesVehicle(input);

  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const id = createLocalId("odo");
  const entry: OdometerEntry = {
    id,
    local_id: id,
    vehicle_id: input.vehicle_id,
    reading: input.reading,
    reading_date: input.reading_date,
    odometer_unit: input.odometer_unit,
    source_type: input.source_type,
    notes: optionalText(input.notes),
    created_at: now,
    updated_at: now,
    sync_status: "local_only",
  };

  await db.runAsync(
    `INSERT INTO odometer_entries (
      id,
      local_id,
      vehicle_id,
      reading,
      reading_date,
      odometer_unit,
      source_type,
      notes,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.local_id,
      entry.vehicle_id,
      entry.reading,
      entry.reading_date,
      entry.odometer_unit,
      entry.source_type,
      bindOptional(entry.notes),
      entry.created_at,
      entry.updated_at,
      entry.sync_status,
    ],
  );

  await recalculateVehicleOdometer(entry.vehicle_id);

  return entry;
};

export const updateOdometerEntry = async (
  id: string,
  input: OdometerEntryInput,
): Promise<OdometerEntry | null> => {
  const existing = await getOdometerEntry(id);

  if (!existing) {
    return null;
  }

  await assertEntryMatchesVehicle(input);

  const db = await getGuestDatabase();
  const updated: OdometerEntry = {
    ...existing,
    ...input,
    notes: optionalText(input.notes),
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE odometer_entries
     SET vehicle_id = ?,
         reading = ?,
         reading_date = ?,
         odometer_unit = ?,
         source_type = ?,
         notes = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      updated.vehicle_id,
      updated.reading,
      updated.reading_date,
      updated.odometer_unit,
      updated.source_type,
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

export const deleteOdometerEntry = async (id: string): Promise<void> => {
  const existing = await getOdometerEntry(id);

  if (!existing) {
    return;
  }

  const db = await getGuestDatabase();
  await db.runAsync(`DELETE FROM odometer_entries WHERE id = ?`, id);
  await recalculateVehicleOdometer(existing.vehicle_id);
};
