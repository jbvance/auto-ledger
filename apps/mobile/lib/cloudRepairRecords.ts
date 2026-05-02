import type { RepairRecord, RepairRecordInput } from "@autoledger/shared";

import {
  getCloudVehicleForOdometer,
  recalculateCloudVehicleOdometer,
} from "./cloudVehicleOdometer";
import { deleteCloudAttachmentsForRepairRecord } from "./cloudRecordAttachments";
import { supabase } from "./supabase";

type CloudRepairRecordError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type CloudRepairRecordRow = Omit<RepairRecord, "category" | "sync_status"> & {
  category: string;
  sync_status: string;
  user_id: string;
  vendor_id: string | null;
};

type CloudRepairRecordPayload = {
  category: RepairRecord["category"];
  cost_amount: number | null;
  cost_currency: string;
  description: string | null;
  local_id?: string;
  notes: string | null;
  odometer_reading: number | null;
  repair_date: string;
  sync_status?: RepairRecord["sync_status"];
  title: string;
  user_id?: string;
  vehicle_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  warranty_until_date: string | null;
  warranty_until_odometer: number | null;
};

const repairRecordSelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  repair_date,
  odometer_reading,
  title,
  category,
  description,
  vendor_id,
  vendor_name,
  cost_amount,
  cost_currency,
  warranty_until_date,
  warranty_until_odometer,
  notes,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const createCloudLocalId = () =>
  `cloud_rep_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const mapCloudRepairRecordRow = (
  row: CloudRepairRecordRow,
): RepairRecord => ({
  ...row,
  category: row.category as RepairRecord["category"],
  cost_amount:
    row.cost_amount === null || row.cost_amount === undefined
      ? row.cost_amount
      : Number(row.cost_amount),
  sync_status: row.sync_status as RepairRecord["sync_status"],
});

const formatCloudRepairRecordError = (
  action: string,
  error: CloudRepairRecordError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase repair_records table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to repair records. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated table grants and Row Level Security policies are installed.`;
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
    throw new Error("Sign in to use cloud repair records.");
  }

  return data.user.id;
};

const assertRepairRecordMatchesCloudVehicle = async (
  input: RepairRecordInput,
  userId: string,
) => {
  const vehicle = await getCloudVehicleForOdometer(input.vehicle_id, userId);

  if (!vehicle) {
    throw new Error("Cloud vehicle not found for this account.");
  }

  return vehicle;
};

const toCloudRepairRecordPayload = (
  input: RepairRecordInput,
): CloudRepairRecordPayload => ({
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

export const listCloudRepairRecords = async (
  vehicleId: string,
): Promise<RepairRecord[]> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("repair_records")
    .select(repairRecordSelect)
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .order("repair_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudRepairRecordError(
        "Unable to load cloud repair records",
        error,
      ),
    );
  }

  return (data as CloudRepairRecordRow[]).map(mapCloudRepairRecordRow);
};

export const getCloudRepairRecord = async (
  id: string,
): Promise<RepairRecord | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("repair_records")
    .select(repairRecordSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudRepairRecordError(
        "Unable to load cloud repair record",
        error,
      ),
    );
  }

  return data ? mapCloudRepairRecordRow(data as CloudRepairRecordRow) : null;
};

export const createCloudRepairRecord = async (
  input: RepairRecordInput,
): Promise<RepairRecord> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  await assertRepairRecordMatchesCloudVehicle(input, userId);

  const payload: CloudRepairRecordPayload = {
    ...toCloudRepairRecordPayload(input),
    local_id: createCloudLocalId(),
    sync_status: "synced",
    user_id: userId,
  };
  const { data, error } = await client
    .from("repair_records")
    .insert(payload)
    .select(repairRecordSelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudRepairRecordError(
        "Unable to create cloud repair record",
        error,
      ),
    );
  }

  await recalculateCloudVehicleOdometer(input.vehicle_id, userId, {
    preserveCurrent: true,
  });

  return mapCloudRepairRecordRow(data as CloudRepairRecordRow);
};

export const updateCloudRepairRecord = async (
  id: string,
  input: RepairRecordInput,
): Promise<RepairRecord | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudRepairRecord(id);

  if (!existing) {
    return null;
  }

  await assertRepairRecordMatchesCloudVehicle(input, userId);

  const { data, error } = await client
    .from("repair_records")
    .update(toCloudRepairRecordPayload(input))
    .eq("id", id)
    .eq("user_id", userId)
    .select(repairRecordSelect)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudRepairRecordError(
        "Unable to update cloud repair record",
        error,
      ),
    );
  }

  await recalculateCloudVehicleOdometer(existing.vehicle_id, userId);

  if (existing.vehicle_id !== input.vehicle_id) {
    await recalculateCloudVehicleOdometer(input.vehicle_id, userId);
  }

  return data ? mapCloudRepairRecordRow(data as CloudRepairRecordRow) : null;
};

export const deleteCloudRepairRecord = async (id: string): Promise<void> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudRepairRecord(id);

  if (!existing) {
    return;
  }

  await deleteCloudAttachmentsForRepairRecord(id);

  const { error } = await client
    .from("repair_records")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      formatCloudRepairRecordError(
        "Unable to delete cloud repair record",
        error,
      ),
    );
  }

  await recalculateCloudVehicleOdometer(existing.vehicle_id, userId);
};
