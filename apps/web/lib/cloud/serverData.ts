import {
  buildVehicleHistoryItems,
  compareMaintenanceRemindersByUrgency,
  type MaintenanceReminder,
  type RecordAttachment,
  type Vehicle,
  type VehicleHistoryItem,
} from "@autoledger/shared";
import type { User } from "@supabase/supabase-js";

import { getWebSupabaseConfig } from "../supabase/config";
import { createClient } from "../supabase/server";
import {
  maintenanceReminderSelect,
  mapCloudMaintenanceReminderRow,
  mapCloudOdometerEntryRow,
  mapCloudRecordAttachmentRow,
  mapCloudRepairRecordRow,
  mapCloudServiceRecordRow,
  mapCloudVehicleRow,
  odometerEntrySelect,
  recordAttachmentSelect,
  repairRecordSelect,
  serviceRecordSelect,
  vehicleSelect,
  type CloudMaintenanceReminderRow,
  type CloudOdometerEntryRow,
  type CloudRecordAttachmentRow,
  type CloudRepairRecordRow,
  type CloudServiceRecordRow,
  type CloudVehicleRow,
} from "./mappers";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

export type WebCloudAuthState =
  | {
      errorMessage: null;
      status: "authenticated";
      user: User;
    }
  | {
      errorMessage: string | null;
      status: "guest" | "unconfigured";
      user: null;
    };

export type WebRecentActivityItem = VehicleHistoryItem & {
  vehicle: Vehicle;
};

export type WebDashboardData = {
  activeReminders: MaintenanceReminder[];
  activeVehicles: Vehicle[];
  archivedVehicleCount: number;
  counts: {
    activeVehicles: number;
    odometerEntries: number;
    repairRecords: number;
    serviceRecords: number;
    upcomingReminders: number;
  };
  recentActivity: WebRecentActivityItem[];
};

export type WebVehicleDetailData = {
  attachments: RecordAttachment[];
  historyItems: VehicleHistoryItem[];
  maintenanceReminders: MaintenanceReminder[];
  odometerEntries: ReturnType<typeof mapCloudOdometerEntryRow>[];
  repairRecords: ReturnType<typeof mapCloudRepairRecordRow>[];
  serviceRecords: ReturnType<typeof mapCloudServiceRecordRow>[];
  vehicle: Vehicle;
};

const formatCloudError = (action: string, error: SupabaseErrorLike) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase cloud tables are not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access. Confirm authenticated grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudError(action, error));
  }
};

export const getWebCloudAuthState = async (): Promise<WebCloudAuthState> => {
  const { isConfigured } = getWebSupabaseConfig();

  if (!isConfigured) {
    return {
      errorMessage:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable web account data.",
      status: "unconfigured",
      user: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return {
      errorMessage: error.message,
      status: "guest",
      user: null,
    };
  }

  if (!data.user) {
    return {
      errorMessage: null,
      status: "guest",
      user: null,
    };
  }

  return {
    errorMessage: null,
    status: "authenticated",
    user: data.user,
  };
};

export const listWebCloudVehicles = async ({
  includeArchived = false,
  userId,
}: {
  includeArchived?: boolean;
  userId: string;
}): Promise<Vehicle[]> => {
  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select(vehicleSelect)
    .eq("user_id", userId)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  throwIfError("Unable to load cloud vehicles", error);

  return ((data ?? []) as CloudVehicleRow[]).map(mapCloudVehicleRow);
};

const countRows = async ({
  activeRemindersOnly,
  table,
  userId,
}: {
  activeRemindersOnly?: boolean;
  table:
    | "maintenance_reminders"
    | "odometer_entries"
    | "repair_records"
    | "service_records";
  userId: string;
}) => {
  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (activeRemindersOnly && table === "maintenance_reminders") {
    query = query.eq("is_completed", false);
  }

  const { count, error } = await query;

  throwIfError(`Unable to count ${table}`, error);

  return count ?? 0;
};

const getArchivedVehicleCount = async (userId: string) => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .filter("archived_at", "not.is", "null");

  throwIfError("Unable to count archived cloud vehicles", error);

  return count ?? 0;
};

const listActiveReminderRows = async ({
  activeVehicles,
  userId,
}: {
  activeVehicles: Vehicle[];
  userId: string;
}) => {
  if (activeVehicles.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .select(maintenanceReminderSelect)
    .eq("user_id", userId)
    .eq("is_completed", false)
    .in(
      "vehicle_id",
      activeVehicles.map((vehicle) => vehicle.id),
    )
    .order("due_date", { ascending: true })
    .order("due_odometer", { ascending: true })
    .order("created_at", { ascending: false });

  throwIfError("Unable to load upcoming cloud reminders", error);

  const vehicleOdometers = Object.fromEntries(
    activeVehicles.map((vehicle) => [vehicle.id, vehicle.current_odometer]),
  );

  return ((data ?? []) as CloudMaintenanceReminderRow[])
    .map(mapCloudMaintenanceReminderRow)
    .sort((first, second) =>
      compareMaintenanceRemindersByUrgency(first, second, vehicleOdometers),
    )
    .slice(0, 6);
};

const listRecentActivity = async ({
  activeVehicles,
  userId,
}: {
  activeVehicles: Vehicle[];
  userId: string;
}): Promise<WebRecentActivityItem[]> => {
  if (activeVehicles.length === 0) {
    return [];
  }

  const vehicleIds = activeVehicles.map((vehicle) => vehicle.id);
  const vehicleById = new Map(
    activeVehicles.map((vehicle) => [vehicle.id, vehicle]),
  );
  const supabase = await createClient();
  const [odometerResult, serviceResult, repairResult] = await Promise.all([
    supabase
      .from("odometer_entries")
      .select(odometerEntrySelect)
      .eq("user_id", userId)
      .in("vehicle_id", vehicleIds)
      .order("reading_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("service_records")
      .select(serviceRecordSelect)
      .eq("user_id", userId)
      .in("vehicle_id", vehicleIds)
      .order("service_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("repair_records")
      .select(repairRecordSelect)
      .eq("user_id", userId)
      .in("vehicle_id", vehicleIds)
      .order("repair_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  throwIfError(
    "Unable to load recent cloud odometer entries",
    odometerResult.error,
  );
  throwIfError(
    "Unable to load recent cloud service records",
    serviceResult.error,
  );
  throwIfError(
    "Unable to load recent cloud repair records",
    repairResult.error,
  );

  return buildVehicleHistoryItems({
    odometerEntries: (
      (odometerResult.data ?? []) as CloudOdometerEntryRow[]
    ).map(mapCloudOdometerEntryRow),
    repairRecords: ((repairResult.data ?? []) as CloudRepairRecordRow[]).map(
      mapCloudRepairRecordRow,
    ),
    serviceRecords: ((serviceResult.data ?? []) as CloudServiceRecordRow[]).map(
      mapCloudServiceRecordRow,
    ),
  })
    .map((item) => {
      const vehicle = vehicleById.get(item.vehicle_id);

      return vehicle ? { ...item, vehicle } : null;
    })
    .filter((item): item is WebRecentActivityItem => item !== null)
    .sort((first, second) => {
      const dateComparison = second.date.localeCompare(first.date);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return second.created_at.localeCompare(first.created_at);
    })
    .slice(0, 6);
};

export const loadWebCloudDashboardData = async (
  userId: string,
): Promise<WebDashboardData> => {
  const activeVehicles = await listWebCloudVehicles({ userId });
  const [
    archivedVehicleCount,
    odometerEntries,
    serviceRecords,
    repairRecords,
    upcomingReminderCount,
    activeReminders,
    recentActivity,
  ] = await Promise.all([
    getArchivedVehicleCount(userId),
    countRows({ table: "odometer_entries", userId }),
    countRows({ table: "service_records", userId }),
    countRows({ table: "repair_records", userId }),
    countRows({
      activeRemindersOnly: true,
      table: "maintenance_reminders",
      userId,
    }),
    listActiveReminderRows({ activeVehicles, userId }),
    listRecentActivity({ activeVehicles, userId }),
  ]);

  return {
    activeReminders,
    activeVehicles,
    archivedVehicleCount,
    counts: {
      activeVehicles: activeVehicles.length,
      odometerEntries,
      repairRecords,
      serviceRecords,
      upcomingReminders: upcomingReminderCount,
    },
    recentActivity,
  };
};

export const loadWebCloudVehicleDetail = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}): Promise<WebVehicleDetailData | null> => {
  const supabase = await createClient();
  const { data: vehicleData, error: vehicleError } = await supabase
    .from("vehicles")
    .select(vehicleSelect)
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .maybeSingle();

  throwIfError("Unable to load cloud vehicle", vehicleError);

  if (!vehicleData) {
    return null;
  }

  const vehicle = mapCloudVehicleRow(vehicleData as CloudVehicleRow);
  const [odometerResult, serviceResult, repairResult, reminderResult] =
    await Promise.all([
      supabase
        .from("odometer_entries")
        .select(odometerEntrySelect)
        .eq("vehicle_id", vehicle.id)
        .eq("user_id", userId)
        .order("reading_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("service_records")
        .select(serviceRecordSelect)
        .eq("vehicle_id", vehicle.id)
        .eq("user_id", userId)
        .order("service_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("repair_records")
        .select(repairRecordSelect)
        .eq("vehicle_id", vehicle.id)
        .eq("user_id", userId)
        .order("repair_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_reminders")
        .select(maintenanceReminderSelect)
        .eq("vehicle_id", vehicle.id)
        .eq("user_id", userId)
        .order("is_completed", { ascending: true })
        .order("due_date", { ascending: true })
        .order("due_odometer", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

  throwIfError("Unable to load cloud odometer entries", odometerResult.error);
  throwIfError("Unable to load cloud service records", serviceResult.error);
  throwIfError("Unable to load cloud repair records", repairResult.error);
  throwIfError(
    "Unable to load cloud maintenance reminders",
    reminderResult.error,
  );

  const odometerEntries = (
    (odometerResult.data ?? []) as CloudOdometerEntryRow[]
  ).map(mapCloudOdometerEntryRow);
  const serviceRecords = (
    (serviceResult.data ?? []) as CloudServiceRecordRow[]
  ).map(mapCloudServiceRecordRow);
  const repairRecords = (
    (repairResult.data ?? []) as CloudRepairRecordRow[]
  ).map(mapCloudRepairRecordRow);
  const maintenanceReminders = (
    (reminderResult.data ?? []) as CloudMaintenanceReminderRow[]
  )
    .map(mapCloudMaintenanceReminderRow)
    .sort((first, second) =>
      compareMaintenanceRemindersByUrgency(first, second, {
        [vehicle.id]: vehicle.current_odometer,
      }),
    );
  const attachments = await listVehicleRecordAttachments({
    repairRecordIds: repairRecords.map((record) => record.id),
    serviceRecordIds: serviceRecords.map((record) => record.id),
    userId,
  });

  return {
    attachments,
    historyItems: buildVehicleHistoryItems({
      odometerEntries,
      repairRecords,
      serviceRecords,
    }),
    maintenanceReminders,
    odometerEntries,
    repairRecords,
    serviceRecords,
    vehicle,
  };
};

const listVehicleRecordAttachments = async ({
  repairRecordIds,
  serviceRecordIds,
  userId,
}: {
  repairRecordIds: string[];
  serviceRecordIds: string[];
  userId: string;
}): Promise<RecordAttachment[]> => {
  if (repairRecordIds.length === 0 && serviceRecordIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const queries = [];

  if (serviceRecordIds.length > 0) {
    queries.push(
      supabase
        .from("record_attachments")
        .select(recordAttachmentSelect)
        .eq("user_id", userId)
        .in("service_record_id", serviceRecordIds)
        .order("created_at", { ascending: false }),
    );
  }

  if (repairRecordIds.length > 0) {
    queries.push(
      supabase
        .from("record_attachments")
        .select(recordAttachmentSelect)
        .eq("user_id", userId)
        .in("repair_record_id", repairRecordIds)
        .order("created_at", { ascending: false }),
    );
  }

  const results = await Promise.all(queries);

  for (const result of results) {
    throwIfError("Unable to load cloud record attachments", result.error);
  }

  return results
    .flatMap((result) => (result.data ?? []) as CloudRecordAttachmentRow[])
    .map(mapCloudRecordAttachmentRow)
    .sort((first, second) => second.created_at.localeCompare(first.created_at));
};
