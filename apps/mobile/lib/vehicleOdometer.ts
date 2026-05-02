import { getRecalculatedVehicleOdometer } from "@autoledger/shared";

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
  const recalculatedOdometer = getRecalculatedVehicleOdometer({
    initialOdometer: vehicle.initial_odometer,
    odometerEntryReadings: [highestOdometerEntry?.reading],
    repairRecordReadings: [highestRepairRecord?.odometer_reading],
    serviceRecordReadings: [highestServiceRecord?.odometer_reading],
  });
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
