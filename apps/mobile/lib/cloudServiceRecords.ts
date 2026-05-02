import type { ServiceRecord, ServiceRecordInput } from "@autoledger/shared";

import {
  getCloudVehicleForOdometer,
  recalculateCloudVehicleOdometer,
} from "./cloudVehicleOdometer";
import { deleteCloudAttachmentsForServiceRecord } from "./cloudRecordAttachments";
import { supabase } from "./supabase";

type CloudServiceRecordError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type CloudServiceRecordRow = Omit<ServiceRecord, "category" | "sync_status"> & {
  category: string;
  sync_status: string;
  user_id: string;
  vendor_id: string | null;
};

type CloudServiceRecordPayload = {
  category: ServiceRecord["category"];
  cost_amount: number | null;
  cost_currency: string;
  description: string | null;
  local_id?: string;
  notes: string | null;
  odometer_reading: number | null;
  service_date: string;
  sync_status?: ServiceRecord["sync_status"];
  title: string;
  user_id?: string;
  vehicle_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
};

const serviceRecordSelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  service_date,
  odometer_reading,
  title,
  category,
  description,
  vendor_id,
  vendor_name,
  cost_amount,
  cost_currency,
  notes,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const createCloudLocalId = () =>
  `cloud_svc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const mapCloudServiceRecordRow = (
  row: CloudServiceRecordRow,
): ServiceRecord => ({
  ...row,
  category: row.category as ServiceRecord["category"],
  cost_amount:
    row.cost_amount === null || row.cost_amount === undefined
      ? row.cost_amount
      : Number(row.cost_amount),
  sync_status: row.sync_status as ServiceRecord["sync_status"],
});

const formatCloudServiceRecordError = (
  action: string,
  error: CloudServiceRecordError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase service_records table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to service records. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated table grants and Row Level Security policies are installed.`;
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
    throw new Error("Sign in to use cloud service records.");
  }

  return data.user.id;
};

const assertServiceRecordMatchesCloudVehicle = async (
  input: ServiceRecordInput,
  userId: string,
) => {
  const vehicle = await getCloudVehicleForOdometer(input.vehicle_id, userId);

  if (!vehicle) {
    throw new Error("Cloud vehicle not found for this account.");
  }

  return vehicle;
};

const toCloudServiceRecordPayload = (
  input: ServiceRecordInput,
): CloudServiceRecordPayload => ({
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

export const listCloudServiceRecords = async (
  vehicleId: string,
): Promise<ServiceRecord[]> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("service_records")
    .select(serviceRecordSelect)
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudServiceRecordError(
        "Unable to load cloud service records",
        error,
      ),
    );
  }

  return (data as CloudServiceRecordRow[]).map(mapCloudServiceRecordRow);
};

export const getCloudServiceRecord = async (
  id: string,
): Promise<ServiceRecord | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("service_records")
    .select(serviceRecordSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudServiceRecordError(
        "Unable to load cloud service record",
        error,
      ),
    );
  }

  return data ? mapCloudServiceRecordRow(data as CloudServiceRecordRow) : null;
};

export const createCloudServiceRecord = async (
  input: ServiceRecordInput,
): Promise<ServiceRecord> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  await assertServiceRecordMatchesCloudVehicle(input, userId);

  const payload: CloudServiceRecordPayload = {
    ...toCloudServiceRecordPayload(input),
    local_id: createCloudLocalId(),
    sync_status: "synced",
    user_id: userId,
  };
  const { data, error } = await client
    .from("service_records")
    .insert(payload)
    .select(serviceRecordSelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudServiceRecordError(
        "Unable to create cloud service record",
        error,
      ),
    );
  }

  await recalculateCloudVehicleOdometer(input.vehicle_id, userId, {
    preserveCurrent: true,
  });

  return mapCloudServiceRecordRow(data as CloudServiceRecordRow);
};

export const updateCloudServiceRecord = async (
  id: string,
  input: ServiceRecordInput,
): Promise<ServiceRecord | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudServiceRecord(id);

  if (!existing) {
    return null;
  }

  await assertServiceRecordMatchesCloudVehicle(input, userId);

  const { data, error } = await client
    .from("service_records")
    .update(toCloudServiceRecordPayload(input))
    .eq("id", id)
    .eq("user_id", userId)
    .select(serviceRecordSelect)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudServiceRecordError(
        "Unable to update cloud service record",
        error,
      ),
    );
  }

  await recalculateCloudVehicleOdometer(existing.vehicle_id, userId);

  if (existing.vehicle_id !== input.vehicle_id) {
    await recalculateCloudVehicleOdometer(input.vehicle_id, userId);
  }

  return data ? mapCloudServiceRecordRow(data as CloudServiceRecordRow) : null;
};

export const deleteCloudServiceRecord = async (id: string): Promise<void> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudServiceRecord(id);

  if (!existing) {
    return;
  }

  await deleteCloudAttachmentsForServiceRecord(id);

  const { error } = await client
    .from("service_records")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      formatCloudServiceRecordError(
        "Unable to delete cloud service record",
        error,
      ),
    );
  }

  await recalculateCloudVehicleOdometer(existing.vehicle_id, userId);
};
