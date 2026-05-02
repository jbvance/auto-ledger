import { getGuestDatabase } from "./database";
import { getVehicle } from "./vehicles";

export const recalculateVehicleOdometer = async (vehicleId: string) => {
  const vehicle = await getVehicle(vehicleId, { includeArchived: true });

  if (!vehicle) {
    return;
  }

  const db = await getGuestDatabase();
  const highestOdometerEntry = await db.getFirstAsync<{
    reading: number | null;
  }>(
    `SELECT MAX(reading) as reading
     FROM odometer_entries
     WHERE vehicle_id = ?`,
    vehicleId,
  );
  const highestServiceRecord = await db.getFirstAsync<{
    odometer_reading: number | null;
  }>(
    `SELECT MAX(odometer_reading) as odometer_reading
     FROM service_records
     WHERE vehicle_id = ? AND odometer_reading IS NOT NULL`,
    vehicleId,
  );
  const highestRepairRecord = await db.getFirstAsync<{
    odometer_reading: number | null;
  }>(
    `SELECT MAX(odometer_reading) as odometer_reading
     FROM repair_records
     WHERE vehicle_id = ? AND odometer_reading IS NOT NULL`,
    vehicleId,
  );
  const recalculatedOdometer = Math.max(
    vehicle.initial_odometer,
    highestOdometerEntry?.reading ?? vehicle.initial_odometer,
    highestServiceRecord?.odometer_reading ?? vehicle.initial_odometer,
    highestRepairRecord?.odometer_reading ?? vehicle.initial_odometer,
  );
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE vehicles
     SET current_odometer = ?, updated_at = ?
     WHERE id = ?`,
    recalculatedOdometer,
    now,
    vehicleId,
  );
};
