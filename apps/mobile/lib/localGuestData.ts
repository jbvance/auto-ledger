import { getGuestDatabase } from "./database";

export const hasAnyLocalGuestData = async () => {
  const db = await getGuestDatabase();
  const tables = [
    "vehicles",
    "odometer_entries",
    "service_records",
    "repair_records",
    "maintenance_reminders",
    "record_attachments",
  ];

  for (const tableName of tables) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${tableName}`,
    );

    if ((row?.count ?? 0) > 0) {
      return true;
    }
  }

  return false;
};
