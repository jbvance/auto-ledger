import type { RepairRecord, RepairRecordInput } from "@autoledger/shared";
import { repairRecordSchema } from "@autoledger/validation";

import { createClient } from "../supabase/server";
import {
  mapCloudRepairRecordRow,
  repairRecordSelect,
  type CloudRepairRecordRow,
} from "./mappers";
import { deleteWebCloudAttachmentsForRepairRecord } from "./recordAttachmentData";
import {
  getWebCloudVehicleForOdometer,
  recalculateWebCloudVehicleOdometer,
} from "./vehicleOdometer";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

export type WebCloudRepairRecordPayload = {
  category: RepairRecord["category"];
  cost_amount: null | number;
  cost_currency: string;
  description: null | string;
  local_id?: string;
  notes: null | string;
  odometer_reading: null | number;
  repair_date: string;
  sync_status?: RepairRecord["sync_status"];
  title: string;
  user_id?: string;
  vehicle_id: string;
  vendor_id: null | string;
  vendor_name: null | string;
  warranty_until_date: null | string;
  warranty_until_odometer: null | number;
};

const optionalText = (value: null | string | undefined) => value ?? null;

const optionalNumber = (value: null | number | undefined) => value ?? null;

const createWebCloudRepairRecordLocalId = () =>
  `web_cloud_rep_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const formatCloudRepairRecordError = (
  action: string,
  error: SupabaseErrorLike,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase repair_records table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to repair records. Confirm authenticated grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudRepairRecordError(action, error));
  }
};

const isValidationErrorLike = (
  error: unknown,
): error is { issues: Array<{ message: string }> } =>
  typeof error === "object" &&
  error !== null &&
  "issues" in error &&
  Array.isArray((error as { issues?: unknown }).issues);

const validateRepairRecordInput = (input: unknown): RepairRecordInput => {
  try {
    return repairRecordSchema.parse(input);
  } catch (error: unknown) {
    if (isValidationErrorLike(error)) {
      throw new Error(
        error.issues[0]?.message ?? "Enter a valid repair record.",
      );
    }

    throw error;
  }
};

const assertRepairRecordMatchesActiveCloudVehicle = async ({
  input,
  userId,
}: {
  input: RepairRecordInput;
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

export const toWebCloudRepairRecordPayload = (
  input: RepairRecordInput,
): WebCloudRepairRecordPayload => ({
  category: input.category,
  cost_amount: optionalNumber(input.cost_amount),
  cost_currency: input.cost_currency || "USD",
  description: optionalText(input.description),
  notes: optionalText(input.notes),
  odometer_reading: optionalNumber(input.odometer_reading),
  repair_date: input.repair_date,
  title: input.title,
  vehicle_id: input.vehicle_id,
  vendor_id: null,
  vendor_name: optionalText(input.vendor_name),
  warranty_until_date: optionalText(input.warranty_until_date),
  warranty_until_odometer: optionalNumber(input.warranty_until_odometer),
});

export const toWebCloudRepairRecordCreatePayload = ({
  input,
  localId = createWebCloudRepairRecordLocalId(),
  userId,
}: {
  input: RepairRecordInput;
  localId?: string;
  userId: string;
}): WebCloudRepairRecordPayload => ({
  ...toWebCloudRepairRecordPayload(input),
  local_id: localId,
  sync_status: "synced",
  user_id: userId,
});

export const getWebCloudRepairRecord = async ({
  repairRecordId,
  userId,
  vehicleId,
}: {
  repairRecordId: string;
  userId: string;
  vehicleId?: string;
}): Promise<RepairRecord | null> => {
  const supabase = await createClient();
  let query = supabase
    .from("repair_records")
    .select(repairRecordSelect)
    .eq("id", repairRecordId)
    .eq("user_id", userId);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query.maybeSingle();

  throwIfError("Unable to load cloud repair record", error);

  return data ? mapCloudRepairRecordRow(data as CloudRepairRecordRow) : null;
};

export const createWebCloudRepairRecord = async ({
  input,
  userId,
}: {
  input: unknown;
  userId: string;
}): Promise<RepairRecord> => {
  const validatedInput = validateRepairRecordInput(input);

  await assertRepairRecordMatchesActiveCloudVehicle({
    input: validatedInput,
    userId,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_records")
    .insert(
      toWebCloudRepairRecordCreatePayload({
        input: validatedInput,
        userId,
      }),
    )
    .select(repairRecordSelect)
    .single();

  throwIfError("Unable to create cloud repair record", error);

  await recalculateWebCloudVehicleOdometer({
    preserveCurrent: true,
    userId,
    vehicleId: validatedInput.vehicle_id,
  });

  return mapCloudRepairRecordRow(data as CloudRepairRecordRow);
};

export const updateWebCloudRepairRecord = async ({
  input,
  repairRecordId,
  userId,
  vehicleId,
}: {
  input: unknown;
  repairRecordId: string;
  userId: string;
  vehicleId: string;
}): Promise<RepairRecord | null> => {
  const validatedInput = validateRepairRecordInput(input);
  const existing = await getWebCloudRepairRecord({
    repairRecordId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return null;
  }

  await assertRepairRecordMatchesActiveCloudVehicle({
    input: validatedInput,
    userId,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_records")
    .update(toWebCloudRepairRecordPayload(validatedInput))
    .eq("id", repairRecordId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .select(repairRecordSelect)
    .maybeSingle();

  throwIfError("Unable to update cloud repair record", error);

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

  return data ? mapCloudRepairRecordRow(data as CloudRepairRecordRow) : null;
};

export const deleteWebCloudRepairRecord = async ({
  repairRecordId,
  userId,
  vehicleId,
}: {
  repairRecordId: string;
  userId: string;
  vehicleId: string;
}): Promise<boolean> => {
  const existing = await getWebCloudRepairRecord({
    repairRecordId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return false;
  }

  await deleteWebCloudAttachmentsForRepairRecord({
    repairRecordId,
    userId,
    vehicleId,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("repair_records")
    .delete()
    .eq("id", repairRecordId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId);

  throwIfError("Unable to delete cloud repair record", error);

  await recalculateWebCloudVehicleOdometer({
    userId,
    vehicleId: existing.vehicle_id,
  });

  return true;
};
