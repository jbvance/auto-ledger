import type { MaintenanceReminder } from "@autoledger/shared";

import { getCloudVehicleForOdometer } from "./cloudVehicleOdometer";
import {
  createMaintenanceReminderMigrationRun,
  getMaintenanceReminderMigrationMappings,
  getVehicleMigrationMappings,
  updateMaintenanceReminderMigrationRunStatus,
  upsertMaintenanceReminderMigrationMapping,
  type MigrationEntityMapping,
  type MigrationRun,
  type MigrationRunMaintenanceReminderCounts,
} from "./guestMigration";
import { listAllMaintenanceReminders } from "./maintenanceReminders";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

type CloudMaintenanceReminderMigrationError = {
  code?: string;
  message: string;
};

type CloudMaintenanceReminderRow = Omit<
  MaintenanceReminder,
  "category" | "reminder_type" | "sync_status"
> & {
  category: string;
  reminder_type: string;
  sync_status: string;
  user_id: string;
};

type MaintenanceReminderMigrationPayload = {
  category: MaintenanceReminder["category"];
  completed_at: string | null;
  created_at: string;
  due_date: string | null;
  due_odometer: number | null;
  is_completed: boolean;
  last_triggered_at: string | null;
  local_id: string;
  notes: string | null;
  reminder_type: MaintenanceReminder["reminder_type"];
  repeat_interval_miles: number | null;
  repeat_interval_months: number | null;
  scheduled_notification_id: null;
  sync_status: "synced";
  title: string;
  updated_at: string;
  user_id: string;
  vehicle_id: string;
};

export type MaintenanceReminderMigrationItemStatus =
  | "already_migrated"
  | "failed"
  | "migrated"
  | "skipped_missing_vehicle_mapping";

export type MaintenanceReminderMigrationItemResult = {
  cloudId: string | null;
  cloudVehicleId: string | null;
  errorMessage: string | null;
  localId: string;
  localVehicleId: string;
  status: MaintenanceReminderMigrationItemStatus;
};

export type GuestMaintenanceReminderMigrationResult = {
  failedCount: number;
  migratedCount: number;
  results: MaintenanceReminderMigrationItemResult[];
  run: MigrationRun;
  skippedCount: number;
  skippedMissingVehicleMappingCount: number;
  totalMaintenanceReminders: number;
};

const maintenanceReminderSelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  title,
  category,
  reminder_type,
  due_date,
  due_odometer,
  repeat_interval_months,
  repeat_interval_miles,
  is_completed,
  completed_at,
  last_triggered_at,
  notes,
  scheduled_notification_id,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapCloudMaintenanceReminderRow = (
  row: CloudMaintenanceReminderRow,
): MaintenanceReminder => ({
  ...row,
  category: row.category as MaintenanceReminder["category"],
  reminder_type: row.reminder_type as MaintenanceReminder["reminder_type"],
  sync_status: row.sync_status as MaintenanceReminder["sync_status"],
});

const formatCloudMaintenanceReminderMigrationError = (
  action: string,
  error: CloudMaintenanceReminderMigrationError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase maintenance_reminders table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql, then review packages/db/sql/004_verify_local_id_unique_constraints.sql before trying reminder migration.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to maintenance reminders. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated grants and RLS policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const isUniqueConflict = (error: CloudMaintenanceReminderMigrationError) =>
  error.code === "23505" ||
  error.message.toLowerCase().includes("duplicate key");

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the public Supabase URL and anon key before migrating reminders.",
    );
  }

  return supabase;
};

const assertAuthenticatedUser = async (userId: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Sign in before migrating reminders.");
  }

  if (data.user.id !== userId) {
    throw new Error("Signed-in account does not match the migration account.");
  }
};

const toMaintenanceReminderMigrationPayload = ({
  cloudVehicleId,
  reminder,
  userId,
}: {
  cloudVehicleId: string;
  reminder: MaintenanceReminder;
  userId: string;
}): MaintenanceReminderMigrationPayload => ({
  category: reminder.category,
  completed_at: optionalText(reminder.completed_at),
  created_at: reminder.created_at,
  due_date: optionalText(reminder.due_date),
  due_odometer: optionalNumber(reminder.due_odometer),
  is_completed: reminder.is_completed,
  last_triggered_at: optionalText(reminder.last_triggered_at),
  local_id: reminder.local_id,
  notes: optionalText(reminder.notes),
  reminder_type: reminder.reminder_type,
  repeat_interval_miles: optionalNumber(reminder.repeat_interval_miles),
  repeat_interval_months: optionalNumber(reminder.repeat_interval_months),
  scheduled_notification_id: null,
  sync_status: "synced",
  title: reminder.title,
  updated_at: reminder.updated_at,
  user_id: userId,
  vehicle_id: cloudVehicleId,
});

const getCloudMaintenanceReminderByLocalId = async (
  localId: string,
  userId: string,
): Promise<MaintenanceReminder | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("maintenance_reminders")
    .select(maintenanceReminderSelect)
    .eq("user_id", userId)
    .eq("local_id", localId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderMigrationError(
        "Unable to check migrated reminder",
        error,
      ),
    );
  }

  return data
    ? mapCloudMaintenanceReminderRow(data as CloudMaintenanceReminderRow)
    : null;
};

const insertMigratedCloudMaintenanceReminder = async ({
  cloudVehicleId,
  reminder,
  userId,
}: {
  cloudVehicleId: string;
  reminder: MaintenanceReminder;
  userId: string;
}): Promise<MaintenanceReminder> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("maintenance_reminders")
    .insert(
      toMaintenanceReminderMigrationPayload({
        cloudVehicleId,
        reminder,
        userId,
      }),
    )
    .select(maintenanceReminderSelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderMigrationError(
        "Unable to migrate reminder",
        error,
      ),
    );
  }

  return mapCloudMaintenanceReminderRow(data as CloudMaintenanceReminderRow);
};

const getVehicleMappingForReminder = async ({
  reminder,
  vehicleMappingsByLocalId,
}: {
  reminder: MaintenanceReminder;
  vehicleMappingsByLocalId: Map<string, MigrationEntityMapping>;
}) => {
  const localVehicle = await getVehicle(reminder.vehicle_id, {
    includeArchived: true,
  });
  const localVehicleLocalId = localVehicle?.local_id ?? reminder.vehicle_id;
  const mapping = vehicleMappingsByLocalId.get(localVehicleLocalId);

  return {
    localVehicleId: reminder.vehicle_id,
    localVehicleLocalId,
    mapping: mapping?.status === "synced" && mapping.cloud_id ? mapping : null,
  };
};

export const migrateGuestMaintenanceReminderToCloud = async (
  reminder: MaintenanceReminder,
  userId: string,
  vehicleMapping: MigrationEntityMapping | null,
  runId: string | null = null,
): Promise<MaintenanceReminderMigrationItemResult> => {
  if (!vehicleMapping?.cloud_id) {
    const errorMessage =
      "Skipped because this reminder's vehicle has not been migrated to this account yet.";

    await upsertMaintenanceReminderMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: reminder.local_id,
      runId,
      status: "skipped",
    });

    return {
      cloudId: null,
      cloudVehicleId: null,
      errorMessage,
      localId: reminder.local_id,
      localVehicleId: reminder.vehicle_id,
      status: "skipped_missing_vehicle_mapping",
    };
  }

  try {
    const cloudVehicle = await getCloudVehicleForOdometer(
      vehicleMapping.cloud_id,
      userId,
      { includeArchived: true },
    );

    if (!cloudVehicle) {
      throw new Error(
        "Mapped cloud vehicle was not found. Rerun vehicle migration before reminder migration.",
      );
    }

    const existingCloudReminder = await getCloudMaintenanceReminderByLocalId(
      reminder.local_id,
      userId,
    );

    if (existingCloudReminder) {
      await upsertMaintenanceReminderMigrationMapping({
        accountId: userId,
        cloudId: existingCloudReminder.id,
        localId: reminder.local_id,
        runId,
        status: "synced",
      });

      return {
        cloudId: existingCloudReminder.id,
        cloudVehicleId: existingCloudReminder.vehicle_id,
        errorMessage: null,
        localId: reminder.local_id,
        localVehicleId: reminder.vehicle_id,
        status: "already_migrated",
      };
    }

    const migratedReminder = await insertMigratedCloudMaintenanceReminder({
      cloudVehicleId: cloudVehicle.id,
      reminder,
      userId,
    });

    await upsertMaintenanceReminderMigrationMapping({
      accountId: userId,
      cloudId: migratedReminder.id,
      localId: reminder.local_id,
      runId,
      status: "synced",
    });

    return {
      cloudId: migratedReminder.id,
      cloudVehicleId: migratedReminder.vehicle_id,
      errorMessage: null,
      localId: reminder.local_id,
      localVehicleId: reminder.vehicle_id,
      status: "migrated",
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unable to migrate reminder.";

    if (
      error instanceof Error &&
      isUniqueConflict({ message: error.message })
    ) {
      const existingCloudReminder = await getCloudMaintenanceReminderByLocalId(
        reminder.local_id,
        userId,
      );

      if (existingCloudReminder) {
        await upsertMaintenanceReminderMigrationMapping({
          accountId: userId,
          cloudId: existingCloudReminder.id,
          localId: reminder.local_id,
          runId,
          status: "synced",
        });

        return {
          cloudId: existingCloudReminder.id,
          cloudVehicleId: existingCloudReminder.vehicle_id,
          errorMessage: null,
          localId: reminder.local_id,
          localVehicleId: reminder.vehicle_id,
          status: "already_migrated",
        };
      }
    }

    await upsertMaintenanceReminderMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: reminder.local_id,
      runId,
      status: "failed",
    });

    return {
      cloudId: null,
      cloudVehicleId: vehicleMapping.cloud_id,
      errorMessage,
      localId: reminder.local_id,
      localVehicleId: reminder.vehicle_id,
      status: "failed",
    };
  }
};

const getMaintenanceReminderMigrationRunStatus = ({
  failedMaintenanceReminders,
  skippedMaintenanceRemindersMissingVehicleMapping,
  totalMaintenanceReminders,
}: Pick<
  MigrationRunMaintenanceReminderCounts,
  | "failedMaintenanceReminders"
  | "skippedMaintenanceRemindersMissingVehicleMapping"
  | "totalMaintenanceReminders"
>) => {
  if (
    failedMaintenanceReminders === 0 &&
    skippedMaintenanceRemindersMissingVehicleMapping === 0
  ) {
    return "completed";
  }

  if (
    failedMaintenanceReminders +
      skippedMaintenanceRemindersMissingVehicleMapping ===
    totalMaintenanceReminders
  ) {
    return "failed";
  }

  return "completed_with_errors";
};

export const migrateGuestMaintenanceRemindersToCloud = async (
  userId: string,
): Promise<GuestMaintenanceReminderMigrationResult> => {
  await assertAuthenticatedUser(userId);

  const [reminders, vehicleMappings] = await Promise.all([
    listAllMaintenanceReminders(),
    getVehicleMigrationMappings(userId),
  ]);
  const run = await createMaintenanceReminderMigrationRun({
    accountId: userId,
    totalMaintenanceReminders: reminders.length,
  });
  const vehicleMappingsByLocalId = new Map(
    vehicleMappings.map((mapping) => [mapping.local_id, mapping]),
  );
  const counts: MigrationRunMaintenanceReminderCounts = {
    failedMaintenanceReminders: 0,
    migratedMaintenanceReminders: 0,
    skippedMaintenanceReminders: 0,
    skippedMaintenanceRemindersMissingVehicleMapping: 0,
    totalMaintenanceReminders: reminders.length,
  };
  const results: MaintenanceReminderMigrationItemResult[] = [];

  for (const reminder of reminders) {
    const { mapping } = await getVehicleMappingForReminder({
      reminder,
      vehicleMappingsByLocalId,
    });
    const result = await migrateGuestMaintenanceReminderToCloud(
      reminder,
      userId,
      mapping,
      run.id,
    );

    results.push(result);

    if (result.status === "migrated") {
      counts.migratedMaintenanceReminders += 1;
    } else if (result.status === "already_migrated") {
      counts.skippedMaintenanceReminders += 1;
    } else if (result.status === "skipped_missing_vehicle_mapping") {
      counts.skippedMaintenanceRemindersMissingVehicleMapping += 1;
    } else {
      counts.failedMaintenanceReminders += 1;
    }

    await updateMaintenanceReminderMigrationRunStatus({
      counts,
      runId: run.id,
      status: "running",
    });
  }

  const completedAt = new Date().toISOString();
  const finalStatus = getMaintenanceReminderMigrationRunStatus(counts);
  const errorParts = [
    counts.failedMaintenanceReminders > 0
      ? `${counts.failedMaintenanceReminders} reminder migration issue${counts.failedMaintenanceReminders === 1 ? "" : "s"} occurred`
      : null,
    counts.skippedMaintenanceRemindersMissingVehicleMapping > 0
      ? `${counts.skippedMaintenanceRemindersMissingVehicleMapping} reminder${counts.skippedMaintenanceRemindersMissingVehicleMapping === 1 ? " was" : "s were"} skipped because vehicle migration mapping was missing`
      : null,
  ].filter(Boolean);
  const errorMessage =
    errorParts.length > 0
      ? `${errorParts.join("; ")}. Local data was not changed.`
      : null;

  await updateMaintenanceReminderMigrationRunStatus({
    completedAt,
    counts,
    errorMessage,
    runId: run.id,
    status: finalStatus,
  });

  return {
    failedCount: counts.failedMaintenanceReminders,
    migratedCount: counts.migratedMaintenanceReminders,
    results,
    run: {
      ...run,
      completed_at: completedAt,
      error_message: errorMessage,
      failed_maintenance_reminders: counts.failedMaintenanceReminders,
      migrated_maintenance_reminders: counts.migratedMaintenanceReminders,
      skipped_maintenance_reminders: counts.skippedMaintenanceReminders,
      skipped_maintenance_reminders_missing_vehicle_mapping:
        counts.skippedMaintenanceRemindersMissingVehicleMapping,
      status: finalStatus,
      total_maintenance_reminders: counts.totalMaintenanceReminders,
      updated_at: completedAt,
    },
    skippedCount: counts.skippedMaintenanceReminders,
    skippedMissingVehicleMappingCount:
      counts.skippedMaintenanceRemindersMissingVehicleMapping,
    totalMaintenanceReminders: counts.totalMaintenanceReminders,
  };
};

export { getMaintenanceReminderMigrationMappings };
