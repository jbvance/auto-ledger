import type {
  MaintenanceReminder,
  MaintenanceReminderInput,
} from "@autoledger/shared";
import { maintenanceReminderSchema } from "@autoledger/validation";

import { createClient } from "../supabase/server";
import {
  maintenanceReminderSelect,
  mapCloudMaintenanceReminderRow,
  type CloudMaintenanceReminderRow,
} from "./mappers";
import { getWebCloudVehicleForOdometer } from "./vehicleOdometer";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

export type WebCloudMaintenanceReminderPayload = {
  category: MaintenanceReminder["category"];
  completed_at?: null | string;
  due_date: null | string;
  due_odometer: null | number;
  is_completed?: boolean;
  last_triggered_at?: null | string;
  local_id?: string;
  notes: null | string;
  reminder_type: MaintenanceReminder["reminder_type"];
  repeat_interval_miles: null | number;
  repeat_interval_months: null | number;
  scheduled_notification_id?: null | string;
  sync_status?: MaintenanceReminder["sync_status"];
  title: string;
  user_id?: string;
  vehicle_id: string;
};

const optionalText = (value: null | string | undefined) => value ?? null;

const optionalNumber = (value: null | number | undefined) => value ?? null;

const createWebCloudReminderLocalId = () =>
  `web_cloud_rem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const formatCloudMaintenanceReminderError = (
  action: string,
  error: SupabaseErrorLike,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase maintenance_reminders table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to maintenance reminders. Confirm authenticated grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudMaintenanceReminderError(action, error));
  }
};

const isValidationErrorLike = (
  error: unknown,
): error is { issues: Array<{ message: string }> } =>
  typeof error === "object" &&
  error !== null &&
  "issues" in error &&
  Array.isArray((error as { issues?: unknown }).issues);

const validateMaintenanceReminderInput = (
  input: unknown,
): MaintenanceReminderInput => {
  try {
    return maintenanceReminderSchema.parse(input);
  } catch (error: unknown) {
    if (isValidationErrorLike(error)) {
      throw new Error(
        error.issues[0]?.message ?? "Enter a valid maintenance reminder.",
      );
    }

    throw error;
  }
};

const assertReminderMatchesActiveCloudVehicle = async ({
  input,
  userId,
}: {
  input: MaintenanceReminderInput;
  userId: string;
}) => {
  const vehicle = await getWebCloudVehicleForOdometer({
    userId,
    vehicleId: input.vehicle_id,
  });

  if (!vehicle) {
    throw new Error("Cloud vehicle not found for this account.");
  }

  return vehicle;
};

const assertActiveCloudVehicle = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}) => {
  const vehicle = await getWebCloudVehicleForOdometer({
    userId,
    vehicleId,
  });

  if (!vehicle) {
    throw new Error("Cloud vehicle not found for this account.");
  }

  return vehicle;
};

export const toWebCloudMaintenanceReminderPayload = (
  input: MaintenanceReminderInput,
): WebCloudMaintenanceReminderPayload => {
  const isDateReminder = input.reminder_type === "date";
  const isMileageReminder = input.reminder_type === "mileage";

  return {
    category: input.category,
    due_date: isMileageReminder ? null : optionalText(input.due_date),
    due_odometer: isDateReminder ? null : optionalNumber(input.due_odometer),
    notes: optionalText(input.notes),
    reminder_type: input.reminder_type,
    repeat_interval_miles: optionalNumber(input.repeat_interval_miles),
    repeat_interval_months: optionalNumber(input.repeat_interval_months),
    title: input.title,
    vehicle_id: input.vehicle_id,
  };
};

export const toWebCloudMaintenanceReminderCreatePayload = ({
  input,
  localId = createWebCloudReminderLocalId(),
  userId,
}: {
  input: MaintenanceReminderInput;
  localId?: string;
  userId: string;
}): WebCloudMaintenanceReminderPayload => ({
  ...toWebCloudMaintenanceReminderPayload(input),
  completed_at: null,
  is_completed: false,
  last_triggered_at: null,
  local_id: localId,
  scheduled_notification_id: null,
  sync_status: "synced",
  user_id: userId,
});

export const getWebCloudMaintenanceReminder = async ({
  reminderId,
  userId,
  vehicleId,
}: {
  reminderId: string;
  userId: string;
  vehicleId?: string;
}): Promise<MaintenanceReminder | null> => {
  const supabase = await createClient();
  let query = supabase
    .from("maintenance_reminders")
    .select(maintenanceReminderSelect)
    .eq("id", reminderId)
    .eq("user_id", userId);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query.maybeSingle();

  throwIfError("Unable to load cloud maintenance reminder", error);

  return data
    ? mapCloudMaintenanceReminderRow(data as CloudMaintenanceReminderRow)
    : null;
};

export const createWebCloudMaintenanceReminder = async ({
  input,
  userId,
}: {
  input: unknown;
  userId: string;
}): Promise<MaintenanceReminder> => {
  const validatedInput = validateMaintenanceReminderInput(input);

  await assertReminderMatchesActiveCloudVehicle({
    input: validatedInput,
    userId,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .insert(
      toWebCloudMaintenanceReminderCreatePayload({
        input: validatedInput,
        userId,
      }),
    )
    .select(maintenanceReminderSelect)
    .single();

  throwIfError("Unable to create cloud maintenance reminder", error);

  return mapCloudMaintenanceReminderRow(data as CloudMaintenanceReminderRow);
};

export const updateWebCloudMaintenanceReminder = async ({
  input,
  reminderId,
  userId,
  vehicleId,
}: {
  input: unknown;
  reminderId: string;
  userId: string;
  vehicleId: string;
}): Promise<MaintenanceReminder | null> => {
  const validatedInput = validateMaintenanceReminderInput(input);
  const existing = await getWebCloudMaintenanceReminder({
    reminderId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return null;
  }

  await assertReminderMatchesActiveCloudVehicle({
    input: validatedInput,
    userId,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .update({
      ...toWebCloudMaintenanceReminderPayload(validatedInput),
      scheduled_notification_id: null,
    })
    .eq("id", reminderId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .select(maintenanceReminderSelect)
    .maybeSingle();

  throwIfError("Unable to update cloud maintenance reminder", error);

  return data
    ? mapCloudMaintenanceReminderRow(data as CloudMaintenanceReminderRow)
    : null;
};

export const completeWebCloudMaintenanceReminder = async ({
  reminderId,
  userId,
  vehicleId,
}: {
  reminderId: string;
  userId: string;
  vehicleId: string;
}): Promise<boolean> => {
  const existing = await getWebCloudMaintenanceReminder({
    reminderId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return false;
  }

  await assertActiveCloudVehicle({ userId, vehicleId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .update({
      completed_at: new Date().toISOString(),
      is_completed: true,
      scheduled_notification_id: null,
    })
    .eq("id", reminderId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .select("id")
    .maybeSingle();

  throwIfError("Unable to complete cloud maintenance reminder", error);

  return Boolean(data);
};

export const deleteWebCloudMaintenanceReminder = async ({
  reminderId,
  userId,
  vehicleId,
}: {
  reminderId: string;
  userId: string;
  vehicleId: string;
}): Promise<boolean> => {
  const existing = await getWebCloudMaintenanceReminder({
    reminderId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return false;
  }

  await assertActiveCloudVehicle({ userId, vehicleId });

  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_reminders")
    .delete()
    .eq("id", reminderId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId);

  throwIfError("Unable to delete cloud maintenance reminder", error);

  return true;
};
