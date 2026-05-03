import * as FileSystem from "expo-file-system/legacy";

import { getGuestDatabase } from "./database";
import { getGuestMigrationSummary } from "./guestMigration";
import {
  deleteAllLocalGuestData,
  getLocalGuestDataControlSummary,
  localGuestDataDeleteConfirmationPhrase,
} from "./localDataControls";
import { cancelAllScheduledReminderNotifications } from "./maintenanceReminders";

jest.mock("./database", () => ({
  getGuestDatabase: jest.fn(),
}));

jest.mock("./guestMigration", () => ({
  getGuestMigrationSummary: jest.fn(),
}));

jest.mock("./maintenanceReminders", () => ({
  cancelAllScheduledReminderNotifications: jest.fn(async () => undefined),
}));

const migrationSummary = {
  accountId: "user-1",
  counts: {
    activeVehicles: 1,
    archivedVehicles: 0,
    attachments: 2,
    completedReminders: 0,
    maintenanceReminders: 1,
    odometerEntries: 1,
    repairRecords: 1,
    serviceRecords: 1,
    totalRecords: 7,
    totalVehicles: 1,
  },
  hasGuestData: true,
  warnings: [],
};

describe("local guest data controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGuestMigrationSummary as jest.Mock).mockResolvedValue(
      migrationSummary,
    );
  });

  it("summarizes local guest data for account and data controls", async () => {
    const summary = await getLocalGuestDataControlSummary("user-1");

    expect(summary.hasLocalGuestData).toBe(true);
    expect(summary.migrationSummary).toBe(migrationSummary);
    expect(getGuestMigrationSummary).toHaveBeenCalledWith("user-1");
    expect(localGuestDataDeleteConfirmationPhrase).toBe("DELETE LOCAL DATA");
  });

  it("deletes local guest rows and only app-owned attachment files", async () => {
    const execAsync = jest.fn(async () => undefined);
    const db = {
      execAsync,
      getAllAsync: jest.fn(async () => [
        { local_uri: "file:///documents/attachments/receipt.pdf" },
        { local_uri: "file:///documents/not-owned.pdf" },
        { local_uri: null },
      ]),
    };
    (getGuestDatabase as jest.Mock).mockResolvedValue(db);

    const result = await deleteAllLocalGuestData();

    expect(cancelAllScheduledReminderNotifications).toHaveBeenCalledTimes(1);
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM record_attachments"),
    );
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM vehicles"),
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      "file:///documents/attachments/receipt.pdf",
      { idempotent: true },
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      deletedRecordCount: 7,
      failedAttachmentFileDeletes: 0,
    });
  });
});
