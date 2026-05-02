import {
  compareMaintenanceRemindersByUrgency,
  type MaintenanceReminder,
  type MaintenanceReminderInput,
} from "@autoledger/shared";

import { listCloudVehicles } from "./cloudVehicles";
import { getCloudVehicleForOdometer } from "./cloudVehicleOdometer";
import { supabase } from "./supabase";

type CloudMaintenanceReminderError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

export type CloudMaintenanceReminderRow = Omit<
  MaintenanceReminder,
  "category" | "reminder_type" | "sync_status"
> & {
  category: string;
  reminder_type: string;
  sync_status: string;
  user_id: string;
};

type CloudMaintenanceReminderPayload = {
  category: MaintenanceReminder["category"];
  completed_at?: string | null;
  due_date: string | null;
  due_odometer: number | null;
  is_completed?: boolean;
  last_triggered_at?: string | null;
  local_id?: string;
  notes: string | null;
  reminder_type: MaintenanceReminder["reminder_type"];
  repeat_interval_miles: number | null;
  repeat_interval_months: number | null;
  scheduled_notification_id?: string | null;
  sync_status?: MaintenanceReminder["sync_status"];
  title: string;
  user_id?: string;
  vehicle_id: string;
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

const createCloudLocalId = () =>
  `cloud_rem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const mapCloudMaintenanceReminderRow = (
  row: CloudMaintenanceReminderRow,
): MaintenanceReminder => ({
  ...row,
  category: row.category as MaintenanceReminder["category"],
  reminder_type: row.reminder_type as MaintenanceReminder["reminder_type"],
  sync_status: row.sync_status as MaintenanceReminder["sync_status"],
});

const formatCloudMaintenanceReminderError = (
  action: string,
  error: CloudMaintenanceReminderError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase maintenance_reminders table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to maintenance reminders. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated table grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the public Supabase URL and anon key.",
    );
  }

  return supabase;
};

const getAuthenticatedUserId = async () => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Sign in to use cloud maintenance reminders.");
  }

  return data.user.id;
};

const assertReminderMatchesCloudVehicle = async (
  input: MaintenanceReminderInput,
  userId: string,
) => {
  const vehicle = await getCloudVehicleForOdometer(input.vehicle_id, userId);

  if (!vehicle) {
    throw new Error("Cloud vehicle not found for this account.");
  }

  return vehicle;
};

const toCloudMaintenanceReminderPayload = (
  input: MaintenanceReminderInput,
): CloudMaintenanceReminderPayload => ({
  category: input.category,
  due_date: optionalText(input.due_date),
  due_odometer: optionalNumber(input.due_odometer),
  notes: optionalText(input.notes),
  reminder_type: input.reminder_type,
  repeat_interval_miles: optionalNumber(input.repeat_interval_miles),
  repeat_interval_months: optionalNumber(input.repeat_interval_months),
  title: input.title,
  vehicle_id: input.vehicle_id,
});

export const listCloudMaintenanceReminders = async (
  vehicleId: string,
): Promise<MaintenanceReminder[]> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const vehicle = await getCloudVehicleForOdometer(vehicleId, userId);

  if (!vehicle) {
    return [];
  }

  const { data, error } = await client
    .from("maintenance_reminders")
    .select(maintenanceReminderSelect)
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .order("is_completed", { ascending: true })
    .order("due_date", { ascending: true })
    .order("due_odometer", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderError(
        "Unable to load cloud maintenance reminders",
        error,
      ),
    );
  }

  return (data as CloudMaintenanceReminderRow[])
    .map(mapCloudMaintenanceReminderRow)
    .sort((first, second) =>
      compareMaintenanceRemindersByUrgency(first, second, {
        [vehicleId]: vehicle.current_odometer,
      }),
    );
};

export const listAllActiveCloudMaintenanceReminders = async (): Promise<
  MaintenanceReminder[]
> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const vehicles = await listCloudVehicles();

  if (vehicles.length === 0) {
    return [];
  }

  const vehicleOdometers = Object.fromEntries(
    vehicles.map((vehicle) => [vehicle.id, vehicle.current_odometer]),
  );
  const { data, error } = await client
    .from("maintenance_reminders")
    .select(maintenanceReminderSelect)
    .eq("user_id", userId)
    .eq("is_completed", false)
    .in(
      "vehicle_id",
      vehicles.map((vehicle) => vehicle.id),
    )
    .order("due_date", { ascending: true })
    .order("due_odometer", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderError(
        "Unable to load active cloud maintenance reminders",
        error,
      ),
    );
  }

  return (data as CloudMaintenanceReminderRow[])
    .map(mapCloudMaintenanceReminderRow)
    .sort((first, second) =>
      compareMaintenanceRemindersByUrgency(first, second, vehicleOdometers),
    );
};

export const getCloudMaintenanceReminder = async (
  id: string,
): Promise<MaintenanceReminder | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("maintenance_reminders")
    .select(maintenanceReminderSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderError(
        "Unable to load cloud maintenance reminder",
        error,
      ),
    );
  }

  return data
    ? mapCloudMaintenanceReminderRow(data as CloudMaintenanceReminderRow)
    : null;
};

export const createCloudMaintenanceReminder = async (
  input: MaintenanceReminderInput,
): Promise<MaintenanceReminder> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  await assertReminderMatchesCloudVehicle(input, userId);

  const payload: CloudMaintenanceReminderPayload = {
    ...toCloudMaintenanceReminderPayload(input),
    completed_at: null,
    is_completed: false,
    last_triggered_at: null,
    local_id: createCloudLocalId(),
    scheduled_notification_id: null,
    sync_status: "synced",
    user_id: userId,
  };
  const { data, error } = await client
    .from("maintenance_reminders")
    .insert(payload)
    .select(maintenanceReminderSelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderError(
        "Unable to create cloud maintenance reminder",
        error,
      ),
    );
  }

  return mapCloudMaintenanceReminderRow(data as CloudMaintenanceReminderRow);
};

export const updateCloudMaintenanceReminder = async (
  id: string,
  input: MaintenanceReminderInput,
): Promise<MaintenanceReminder | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudMaintenanceReminder(id);

  if (!existing) {
    return null;
  }

  await assertReminderMatchesCloudVehicle(input, userId);

  const { data, error } = await client
    .from("maintenance_reminders")
    .update({
      ...toCloudMaintenanceReminderPayload(input),
      scheduled_notification_id: null,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select(maintenanceReminderSelect)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderError(
        "Unable to update cloud maintenance reminder",
        error,
      ),
    );
  }

  return data
    ? mapCloudMaintenanceReminderRow(data as CloudMaintenanceReminderRow)
    : null;
};

export const completeCloudMaintenanceReminder = async (
  id: string,
): Promise<void> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const now = new Date().toISOString();
  const { error } = await client
    .from("maintenance_reminders")
    .update({
      completed_at: now,
      is_completed: true,
      scheduled_notification_id: null,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderError(
        "Unable to complete cloud maintenance reminder",
        error,
      ),
    );
  }
};

export const deleteCloudMaintenanceReminder = async (
  id: string,
): Promise<void> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { error } = await client
    .from("maintenance_reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      formatCloudMaintenanceReminderError(
        "Unable to delete cloud maintenance reminder",
        error,
      ),
    );
  }
};
