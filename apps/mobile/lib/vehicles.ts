import type { Vehicle, VehicleInput } from "@autoledger/shared";

import { bindOptional, createLocalId, getGuestDatabase } from "./database";

type VehicleRow = Omit<Vehicle, "vehicle_type" | "odometer_unit"> & {
  vehicle_type: string;
  odometer_unit: string;
};

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapVehicleRow = (row: VehicleRow): Vehicle => ({
  ...row,
  vehicle_type: row.vehicle_type as Vehicle["vehicle_type"],
  odometer_unit: row.odometer_unit as Vehicle["odometer_unit"],
  sync_status: row.sync_status as Vehicle["sync_status"],
});

export const listVehicles = async (): Promise<Vehicle[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<VehicleRow>(
    `SELECT * FROM vehicles
     WHERE archived_at IS NULL
     ORDER BY updated_at DESC, created_at DESC`,
  );

  return rows.map(mapVehicleRow);
};

export const listArchivedVehicles = async (): Promise<Vehicle[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<VehicleRow>(
    `SELECT * FROM vehicles
     WHERE archived_at IS NOT NULL
     ORDER BY archived_at DESC, updated_at DESC`,
  );

  return rows.map(mapVehicleRow);
};

export const getVehicle = async (
  id: string,
  options: { includeArchived?: boolean } = {},
): Promise<Vehicle | null> => {
  const db = await getGuestDatabase();
  const row = options.includeArchived
    ? await db.getFirstAsync<VehicleRow>(
        `SELECT * FROM vehicles
         WHERE id = ?
         LIMIT 1`,
        id,
      )
    : await db.getFirstAsync<VehicleRow>(
        `SELECT * FROM vehicles
         WHERE id = ? AND archived_at IS NULL
         LIMIT 1`,
        id,
      );

  return row ? mapVehicleRow(row) : null;
};

export const createVehicle = async (input: VehicleInput): Promise<Vehicle> => {
  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const id = createLocalId("veh");

  const vehicle: Vehicle = {
    id,
    local_id: id,
    nickname: input.nickname,
    make: input.make,
    model: input.model,
    year: input.year,
    trim: optionalText(input.trim),
    vin: optionalText(input.vin),
    license_plate: optionalText(input.license_plate),
    license_state: optionalText(input.license_state),
    color: optionalText(input.color),
    vehicle_type: input.vehicle_type,
    initial_odometer: input.current_odometer,
    current_odometer: input.current_odometer,
    odometer_unit: input.odometer_unit,
    purchase_date: optionalText(input.purchase_date),
    purchase_odometer: optionalNumber(input.purchase_odometer),
    notes: optionalText(input.notes),
    archived_at: null,
    created_at: now,
    updated_at: now,
    sync_status: "local_only",
  };

  await db.runAsync(
    `INSERT INTO vehicles (
      id,
      local_id,
      nickname,
      make,
      model,
      year,
      trim,
      vin,
      license_plate,
      license_state,
      color,
      vehicle_type,
      initial_odometer,
      current_odometer,
      odometer_unit,
      purchase_date,
      purchase_odometer,
      notes,
      archived_at,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vehicle.id,
      vehicle.local_id,
      vehicle.nickname,
      vehicle.make,
      vehicle.model,
      vehicle.year,
      bindOptional(vehicle.trim),
      bindOptional(vehicle.vin),
      bindOptional(vehicle.license_plate),
      bindOptional(vehicle.license_state),
      bindOptional(vehicle.color),
      vehicle.vehicle_type,
      vehicle.initial_odometer,
      vehicle.current_odometer,
      vehicle.odometer_unit,
      bindOptional(vehicle.purchase_date),
      bindOptional(vehicle.purchase_odometer),
      bindOptional(vehicle.notes),
      bindOptional(vehicle.archived_at),
      vehicle.created_at,
      vehicle.updated_at,
      vehicle.sync_status,
    ],
  );

  return vehicle;
};

export const updateVehicle = async (
  id: string,
  input: Partial<VehicleInput>,
): Promise<Vehicle | null> => {
  const existing = await getVehicle(id);

  if (!existing) {
    return null;
  }

  const db = await getGuestDatabase();
  const updated: Vehicle = {
    ...existing,
    ...input,
    trim: input.trim === undefined ? existing.trim : optionalText(input.trim),
    vin: input.vin === undefined ? existing.vin : optionalText(input.vin),
    license_plate:
      input.license_plate === undefined
        ? existing.license_plate
        : optionalText(input.license_plate),
    license_state:
      input.license_state === undefined
        ? existing.license_state
        : optionalText(input.license_state),
    color:
      input.color === undefined ? existing.color : optionalText(input.color),
    purchase_date:
      input.purchase_date === undefined
        ? existing.purchase_date
        : optionalText(input.purchase_date),
    purchase_odometer:
      input.purchase_odometer === undefined
        ? existing.purchase_odometer
        : optionalNumber(input.purchase_odometer),
    notes:
      input.notes === undefined ? existing.notes : optionalText(input.notes),
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE vehicles
     SET nickname = ?,
         make = ?,
         model = ?,
         year = ?,
         trim = ?,
         vin = ?,
         license_plate = ?,
         license_state = ?,
         color = ?,
         vehicle_type = ?,
         current_odometer = ?,
         odometer_unit = ?,
         purchase_date = ?,
         purchase_odometer = ?,
         notes = ?,
         updated_at = ?
     WHERE id = ? AND archived_at IS NULL`,
    [
      updated.nickname,
      updated.make,
      updated.model,
      updated.year,
      bindOptional(updated.trim),
      bindOptional(updated.vin),
      bindOptional(updated.license_plate),
      bindOptional(updated.license_state),
      bindOptional(updated.color),
      updated.vehicle_type,
      updated.current_odometer,
      updated.odometer_unit,
      bindOptional(updated.purchase_date),
      bindOptional(updated.purchase_odometer),
      bindOptional(updated.notes),
      updated.updated_at,
      id,
    ],
  );

  return updated;
};

export const archiveVehicle = async (id: string): Promise<void> => {
  const db = await getGuestDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE vehicles
     SET archived_at = ?, updated_at = ?
     WHERE id = ? AND archived_at IS NULL`,
    now,
    now,
    id,
  );
};

export const restoreVehicle = async (id: string): Promise<void> => {
  const db = await getGuestDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE vehicles
     SET archived_at = NULL, updated_at = ?
     WHERE id = ? AND archived_at IS NOT NULL`,
    now,
    id,
  );
};
