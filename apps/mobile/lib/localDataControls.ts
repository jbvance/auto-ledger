import * as FileSystem from "expo-file-system/legacy";

import { getGuestDatabase } from "./database";
import {
  getGuestMigrationSummary,
  type GuestMigrationSummary,
} from "./guestMigration";
import { cancelAllScheduledReminderNotifications } from "./maintenanceReminders";

const attachmentsDirectory = `${FileSystem.documentDirectory ?? ""}attachments/`;

export const localGuestDataDeleteConfirmationPhrase = "DELETE LOCAL DATA";

export type LocalGuestDataControlSummary = {
  hasLocalGuestData: boolean;
  migrationSummary: GuestMigrationSummary;
};

export type DeleteLocalGuestDataResult = {
  deletedRecordCount: number;
  failedAttachmentFileDeletes: number;
  summaryBeforeDelete: GuestMigrationSummary;
};

const getOwnedLocalAttachmentUris = async () => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<{ local_uri: string | null }>(
    `SELECT local_uri
     FROM record_attachments
     WHERE local_uri IS NOT NULL`,
  );

  if (!FileSystem.documentDirectory) {
    return [];
  }

  return rows
    .map((row) => row.local_uri?.trim() ?? "")
    .filter((uri) => uri.startsWith(attachmentsDirectory));
};

export const getLocalGuestDataControlSummary = async (
  accountId: string | null = null,
): Promise<LocalGuestDataControlSummary> => {
  const migrationSummary = await getGuestMigrationSummary(accountId);

  return {
    hasLocalGuestData: migrationSummary.hasGuestData,
    migrationSummary,
  };
};

export const deleteAllLocalGuestData = async (): Promise<DeleteLocalGuestDataResult> => {
  const summaryBeforeDelete = await getGuestMigrationSummary();
  const attachmentUris = await getOwnedLocalAttachmentUris();

  await cancelAllScheduledReminderNotifications();

  const db = await getGuestDatabase();

  try {
    await db.execAsync(`
      BEGIN;
      DELETE FROM migration_entity_mappings;
      DELETE FROM migration_runs;
      DELETE FROM record_attachments;
      DELETE FROM maintenance_reminders;
      DELETE FROM odometer_entries;
      DELETE FROM service_records;
      DELETE FROM repair_records;
      DELETE FROM vehicles;
      COMMIT;
    `);
  } catch (error) {
    await db.execAsync("ROLLBACK;").catch(() => undefined);
    throw error;
  }

  let failedAttachmentFileDeletes = 0;

  for (const uri of attachmentUris) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error: unknown) {
      failedAttachmentFileDeletes += 1;
      console.warn("Unable to delete local guest attachment file.", error);
    }
  }

  return {
    deletedRecordCount: summaryBeforeDelete.counts.totalRecords,
    failedAttachmentFileDeletes,
    summaryBeforeDelete,
  };
};
