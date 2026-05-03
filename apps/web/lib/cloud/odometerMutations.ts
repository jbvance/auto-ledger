import type { OdometerEntry, OdometerEntryInput } from "@autoledger/shared";
import { odometerEntrySchema } from "@autoledger/validation";

import { createClient } from "../supabase/server";
import {
  mapCloudOdometerEntryRow,
  odometerEntrySelect,
  type CloudOdometerEntryRow,
} from "./mappers";
import {
  getWebCloudVehicleForOdometer,
  recalculateWebCloudVehicleOdometer,
} from "./vehicleOdometer";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

export type WebCloudOdometerEntryPayload = {
  local_id?: string;
  notes: null | string;
  odometer_unit: OdometerEntry["odometer_unit"];
  reading: number;
  reading_date: string;
  source_type: OdometerEntry["source_type"];
  sync_status?: OdometerEntry["sync_status"];
  user_id?: string;
  vehicle_id: string;
};

const optionalText = (value: null | string | undefined) => value ?? null;

const createWebCloudOdometerLocalId = () =>
  `web_cloud_odo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const formatCloudOdometerError = (
  action: string,
  error: SupabaseErrorLike,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase odometer_entries table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to odometer entries. Confirm authenticated grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudOdometerError(action, error));
  }
};

const isValidationErrorLike = (
  error: unknown,
): error is { issues: Array<{ message: string }> } =>
  typeof error === "object" &&
  error !== null &&
  "issues" in error &&
  Array.isArray((error as { issues?: unknown }).issues);

const validateOdometerEntryInput = (input: unknown): OdometerEntryInput => {
  try {
    return odometerEntrySchema.parse(input);
  } catch (error: unknown) {
    if (isValidationErrorLike(error)) {
      throw new Error(
        error.issues[0]?.message ?? "Enter a valid odometer entry.",
      );
    }

    throw error;
  }
};

const assertEntryMatchesActiveCloudVehicle = async ({
  input,
  userId,
}: {
  input: OdometerEntryInput;
  userId: string;
}) => {
  const vehicle = await getWebCloudVehicleForOdometer({
    userId,
    vehicleId: input.vehicle_id,
  });

  if (!vehicle) {
    throw new Error("Cloud vehicle not found for this account.");
  }

  if (input.odometer_unit !== vehicle.odometer_unit) {
    throw new Error("Odometer unit must match the cloud vehicle.");
  }

  return vehicle;
};

export const toWebCloudOdometerEntryPayload = (
  input: OdometerEntryInput,
): WebCloudOdometerEntryPayload => ({
  notes: optionalText(input.notes),
  odometer_unit: input.odometer_unit,
  reading: input.reading,
  reading_date: input.reading_date,
  source_type: input.source_type,
  vehicle_id: input.vehicle_id,
});

export const toWebCloudOdometerEntryCreatePayload = ({
  input,
  localId = createWebCloudOdometerLocalId(),
  userId,
}: {
  input: OdometerEntryInput;
  localId?: string;
  userId: string;
}): WebCloudOdometerEntryPayload => ({
  ...toWebCloudOdometerEntryPayload(input),
  local_id: localId,
  sync_status: "synced",
  user_id: userId,
});

export const getWebCloudOdometerEntry = async ({
  entryId,
  userId,
  vehicleId,
}: {
  entryId: string;
  userId: string;
  vehicleId?: string;
}): Promise<OdometerEntry | null> => {
  const supabase = await createClient();
  let query = supabase
    .from("odometer_entries")
    .select(odometerEntrySelect)
    .eq("id", entryId)
    .eq("user_id", userId);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query.maybeSingle();

  throwIfError("Unable to load cloud odometer entry", error);

  return data ? mapCloudOdometerEntryRow(data as CloudOdometerEntryRow) : null;
};

export const createWebCloudOdometerEntry = async ({
  input,
  userId,
}: {
  input: unknown;
  userId: string;
}): Promise<OdometerEntry> => {
  const validatedInput = validateOdometerEntryInput(input);

  await assertEntryMatchesActiveCloudVehicle({
    input: validatedInput,
    userId,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("odometer_entries")
    .insert(
      toWebCloudOdometerEntryCreatePayload({
        input: validatedInput,
        userId,
      }),
    )
    .select(odometerEntrySelect)
    .single();

  throwIfError("Unable to create cloud odometer entry", error);

  await recalculateWebCloudVehicleOdometer({
    preserveCurrent: true,
    userId,
    vehicleId: validatedInput.vehicle_id,
  });

  return mapCloudOdometerEntryRow(data as CloudOdometerEntryRow);
};

export const updateWebCloudOdometerEntry = async ({
  entryId,
  input,
  userId,
  vehicleId,
}: {
  entryId: string;
  input: unknown;
  userId: string;
  vehicleId: string;
}): Promise<OdometerEntry | null> => {
  const validatedInput = validateOdometerEntryInput(input);
  const existing = await getWebCloudOdometerEntry({
    entryId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return null;
  }

  await assertEntryMatchesActiveCloudVehicle({
    input: validatedInput,
    userId,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("odometer_entries")
    .update(toWebCloudOdometerEntryPayload(validatedInput))
    .eq("id", entryId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .select(odometerEntrySelect)
    .maybeSingle();

  throwIfError("Unable to update cloud odometer entry", error);

  await recalculateWebCloudVehicleOdometer({
    userId,
    vehicleId: existing.vehicle_id,
  });

  if (existing.vehicle_id !== validatedInput.vehicle_id) {
    await recalculateWebCloudVehicleOdometer({
      userId,
      vehicleId: validatedInput.vehicle_id,
    });
  }

  return data ? mapCloudOdometerEntryRow(data as CloudOdometerEntryRow) : null;
};

export const deleteWebCloudOdometerEntry = async ({
  entryId,
  userId,
  vehicleId,
}: {
  entryId: string;
  userId: string;
  vehicleId: string;
}): Promise<boolean> => {
  const existing = await getWebCloudOdometerEntry({
    entryId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return false;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("odometer_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId);

  throwIfError("Unable to delete cloud odometer entry", error);

  await recalculateWebCloudVehicleOdometer({
    userId,
    vehicleId: existing.vehicle_id,
  });

  return true;
};
