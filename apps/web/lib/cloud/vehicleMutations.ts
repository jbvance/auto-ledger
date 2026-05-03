import type { Vehicle, VehicleInput } from "@autoledger/shared";
import { vehicleSchema } from "@autoledger/validation";

import { createClient } from "../supabase/server";
import { mapCloudVehicleRow, vehicleSelect, type CloudVehicleRow } from "./mappers";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

export type WebCloudVehiclePayload = {
  color: null | string;
  current_odometer: number;
  initial_odometer?: number;
  license_plate: null | string;
  license_state: null | string;
  local_id?: string;
  make: string;
  model: string;
  nickname: string;
  notes: null | string;
  odometer_unit: Vehicle["odometer_unit"];
  purchase_date: null | string;
  purchase_odometer: null | number;
  sync_status?: Vehicle["sync_status"];
  trim: null | string;
  user_id?: string;
  vehicle_type: Vehicle["vehicle_type"];
  vin: null | string;
  year: number;
};

const optionalText = (value: null | string | undefined) => value ?? null;

const optionalNumber = (value: null | number | undefined) => value ?? null;

const createWebCloudLocalId = () =>
  `web_cloud_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const formatCloudVehicleError = (action: string, error: SupabaseErrorLike) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase vehicles table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to vehicles. Confirm authenticated grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudVehicleError(action, error));
  }
};

const isValidationErrorLike = (
  error: unknown,
): error is { issues: Array<{ message: string }> } =>
  typeof error === "object" &&
  error !== null &&
  "issues" in error &&
  Array.isArray((error as { issues?: unknown }).issues);

const validateVehicleInput = (input: unknown): VehicleInput => {
  try {
    return vehicleSchema.parse(input);
  } catch (error: unknown) {
    if (isValidationErrorLike(error)) {
      throw new Error(
        error.issues[0]?.message ?? "Enter valid vehicle details.",
      );
    }

    throw error;
  }
};

export const toWebCloudVehiclePayload = (
  input: VehicleInput,
): WebCloudVehiclePayload => ({
  color: optionalText(input.color),
  current_odometer: input.current_odometer,
  license_plate: optionalText(input.license_plate),
  license_state: optionalText(input.license_state),
  make: input.make,
  model: input.model,
  nickname: input.nickname,
  notes: optionalText(input.notes),
  odometer_unit: input.odometer_unit,
  purchase_date: optionalText(input.purchase_date),
  purchase_odometer: optionalNumber(input.purchase_odometer),
  trim: optionalText(input.trim),
  vehicle_type: input.vehicle_type,
  vin: optionalText(input.vin),
  year: input.year,
});

export const toWebCloudVehicleCreatePayload = ({
  input,
  localId = createWebCloudLocalId(),
  userId,
}: {
  input: VehicleInput;
  localId?: string;
  userId: string;
}): WebCloudVehiclePayload => ({
  ...toWebCloudVehiclePayload(input),
  initial_odometer: input.current_odometer,
  local_id: localId,
  sync_status: "synced",
  user_id: userId,
});

export const toWebCloudVehicleUpdatePayload = ({
  existingInitialOdometer,
  input,
}: {
  existingInitialOdometer: number;
  input: VehicleInput;
}): WebCloudVehiclePayload => ({
  ...toWebCloudVehiclePayload(input),
  initial_odometer: Math.min(existingInitialOdometer, input.current_odometer),
});

const getActiveWebCloudVehicle = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}): Promise<Vehicle | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(vehicleSelect)
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();

  throwIfError("Unable to load cloud vehicle", error);

  return data ? mapCloudVehicleRow(data as CloudVehicleRow) : null;
};

const getArchivedWebCloudVehicle = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}): Promise<Vehicle | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(vehicleSelect)
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .filter("archived_at", "not.is", "null")
    .maybeSingle();

  throwIfError("Unable to load archived cloud vehicle", error);

  return data ? mapCloudVehicleRow(data as CloudVehicleRow) : null;
};

export const createWebCloudVehicle = async ({
  input,
  userId,
}: {
  input: unknown;
  userId: string;
}): Promise<Vehicle> => {
  const validatedInput = validateVehicleInput(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .insert(toWebCloudVehicleCreatePayload({ input: validatedInput, userId }))
    .select(vehicleSelect)
    .single();

  throwIfError("Unable to create cloud vehicle", error);

  return mapCloudVehicleRow(data as CloudVehicleRow);
};

export const updateWebCloudVehicle = async ({
  input,
  userId,
  vehicleId,
}: {
  input: unknown;
  userId: string;
  vehicleId: string;
}): Promise<Vehicle | null> => {
  const validatedInput = validateVehicleInput(input);
  const existing = await getActiveWebCloudVehicle({ userId, vehicleId });

  if (!existing) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update(
      toWebCloudVehicleUpdatePayload({
        existingInitialOdometer: existing.initial_odometer,
        input: validatedInput,
      }),
    )
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .select(vehicleSelect)
    .maybeSingle();

  throwIfError("Unable to update cloud vehicle", error);

  return data ? mapCloudVehicleRow(data as CloudVehicleRow) : null;
};

export const archiveWebCloudVehicle = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}): Promise<boolean> => {
  const existing = await getActiveWebCloudVehicle({ userId, vehicleId });

  if (!existing) {
    return false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  throwIfError("Unable to archive cloud vehicle", error);

  return Boolean(data);
};

export const restoreWebCloudVehicle = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}): Promise<boolean> => {
  const existing = await getArchivedWebCloudVehicle({ userId, vehicleId });

  if (!existing) {
    return false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update({ archived_at: null })
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .filter("archived_at", "not.is", "null")
    .select("id")
    .maybeSingle();

  throwIfError("Unable to restore cloud vehicle", error);

  return Boolean(data);
};
