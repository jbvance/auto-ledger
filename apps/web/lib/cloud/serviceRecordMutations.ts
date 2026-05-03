import type { ServiceRecord, ServiceRecordInput } from "@autoledger/shared";
import { serviceRecordSchema } from "@autoledger/validation";

import { createClient } from "../supabase/server";
import {
  mapCloudServiceRecordRow,
  serviceRecordSelect,
  type CloudServiceRecordRow,
} from "./mappers";
import { deleteWebCloudAttachmentsForServiceRecord } from "./recordAttachmentData";
import {
  getWebCloudVehicleForOdometer,
  recalculateWebCloudVehicleOdometer,
} from "./vehicleOdometer";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

export type WebCloudServiceRecordPayload = {
  category: ServiceRecord["category"];
  cost_amount: null | number;
  cost_currency: string;
  description: null | string;
  local_id?: string;
  notes: null | string;
  odometer_reading: null | number;
  service_date: string;
  sync_status?: ServiceRecord["sync_status"];
  title: string;
  user_id?: string;
  vehicle_id: string;
  vendor_id: null | string;
  vendor_name: null | string;
};

const optionalText = (value: null | string | undefined) => value ?? null;

const optionalNumber = (value: null | number | undefined) => value ?? null;

const createWebCloudServiceRecordLocalId = () =>
  `web_cloud_svc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const formatCloudServiceRecordError = (
  action: string,
  error: SupabaseErrorLike,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase service_records table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to service records. Confirm authenticated grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudServiceRecordError(action, error));
  }
};

const isValidationErrorLike = (
  error: unknown,
): error is { issues: Array<{ message: string }> } =>
  typeof error === "object" &&
  error !== null &&
  "issues" in error &&
  Array.isArray((error as { issues?: unknown }).issues);

const validateServiceRecordInput = (input: unknown): ServiceRecordInput => {
  try {
    return serviceRecordSchema.parse(input);
  } catch (error: unknown) {
    if (isValidationErrorLike(error)) {
      throw new Error(
        error.issues[0]?.message ?? "Enter a valid service record.",
      );
    }

    throw error;
  }
};

const assertServiceRecordMatchesActiveCloudVehicle = async ({
  input,
  userId,
}: {
  input: ServiceRecordInput;
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

export const toWebCloudServiceRecordPayload = (
  input: ServiceRecordInput,
): WebCloudServiceRecordPayload => ({
  category: input.category,
  cost_amount: optionalNumber(input.cost_amount),
  cost_currency: input.cost_currency || "USD",
  description: optionalText(input.description),
  notes: optionalText(input.notes),
  odometer_reading: optionalNumber(input.odometer_reading),
  service_date: input.service_date,
  title: input.title,
  vehicle_id: input.vehicle_id,
  vendor_id: null,
  vendor_name: optionalText(input.vendor_name),
});

export const toWebCloudServiceRecordCreatePayload = ({
  input,
  localId = createWebCloudServiceRecordLocalId(),
  userId,
}: {
  input: ServiceRecordInput;
  localId?: string;
  userId: string;
}): WebCloudServiceRecordPayload => ({
  ...toWebCloudServiceRecordPayload(input),
  local_id: localId,
  sync_status: "synced",
  user_id: userId,
});

export const getWebCloudServiceRecord = async ({
  serviceRecordId,
  userId,
  vehicleId,
}: {
  serviceRecordId: string;
  userId: string;
  vehicleId?: string;
}): Promise<ServiceRecord | null> => {
  const supabase = await createClient();
  let query = supabase
    .from("service_records")
    .select(serviceRecordSelect)
    .eq("id", serviceRecordId)
    .eq("user_id", userId);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query.maybeSingle();

  throwIfError("Unable to load cloud service record", error);

  return data ? mapCloudServiceRecordRow(data as CloudServiceRecordRow) : null;
};

export const createWebCloudServiceRecord = async ({
  input,
  userId,
}: {
  input: unknown;
  userId: string;
}): Promise<ServiceRecord> => {
  const validatedInput = validateServiceRecordInput(input);

  await assertServiceRecordMatchesActiveCloudVehicle({
    input: validatedInput,
    userId,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_records")
    .insert(
      toWebCloudServiceRecordCreatePayload({
        input: validatedInput,
        userId,
      }),
    )
    .select(serviceRecordSelect)
    .single();

  throwIfError("Unable to create cloud service record", error);

  await recalculateWebCloudVehicleOdometer({
    preserveCurrent: true,
    userId,
    vehicleId: validatedInput.vehicle_id,
  });

  return mapCloudServiceRecordRow(data as CloudServiceRecordRow);
};

export const updateWebCloudServiceRecord = async ({
  input,
  serviceRecordId,
  userId,
  vehicleId,
}: {
  input: unknown;
  serviceRecordId: string;
  userId: string;
  vehicleId: string;
}): Promise<ServiceRecord | null> => {
  const validatedInput = validateServiceRecordInput(input);
  const existing = await getWebCloudServiceRecord({
    serviceRecordId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return null;
  }

  await assertServiceRecordMatchesActiveCloudVehicle({
    input: validatedInput,
    userId,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_records")
    .update(toWebCloudServiceRecordPayload(validatedInput))
    .eq("id", serviceRecordId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .select(serviceRecordSelect)
    .maybeSingle();

  throwIfError("Unable to update cloud service record", error);

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

  return data ? mapCloudServiceRecordRow(data as CloudServiceRecordRow) : null;
};

export const deleteWebCloudServiceRecord = async ({
  serviceRecordId,
  userId,
  vehicleId,
}: {
  serviceRecordId: string;
  userId: string;
  vehicleId: string;
}): Promise<boolean> => {
  const existing = await getWebCloudServiceRecord({
    serviceRecordId,
    userId,
    vehicleId,
  });

  if (!existing) {
    return false;
  }

  await deleteWebCloudAttachmentsForServiceRecord({
    serviceRecordId,
    userId,
    vehicleId,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_records")
    .delete()
    .eq("id", serviceRecordId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId);

  throwIfError("Unable to delete cloud service record", error);

  await recalculateWebCloudVehicleOdometer({
    userId,
    vehicleId: existing.vehicle_id,
  });

  return true;
};
