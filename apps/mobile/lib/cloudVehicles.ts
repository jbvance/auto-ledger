import type { Vehicle, VehicleInput } from "@autoledger/shared";

import { supabase } from "./supabase";

type CloudVehicleError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type CloudVehicleRow = Omit<
  Vehicle,
  "odometer_unit" | "sync_status" | "vehicle_type"
> & {
  odometer_unit: string;
  sync_status: string;
  user_id: string;
  vehicle_type: string;
};

type CloudVehiclePayload = {
  color: string | null;
  current_odometer: number;
  initial_odometer?: number;
  license_plate: string | null;
  license_state: string | null;
  local_id?: string;
  make: string;
  model: string;
  nickname: string;
  notes: string | null;
  odometer_unit: Vehicle["odometer_unit"];
  purchase_date: string | null;
  purchase_odometer: number | null;
  sync_status?: Vehicle["sync_status"];
  trim: string | null;
  user_id?: string;
  vehicle_type: Vehicle["vehicle_type"];
  vin: string | null;
  year: number;
};

const vehicleSelect = `
  id,
  user_id,
  local_id,
  nickname,
  make,
  model,
  year,
  trim,
  vin,
  license_plate,
  license_state,
  color,
  vehicle_type,
  initial_odometer,
  current_odometer,
  odometer_unit,
  purchase_date,
  purchase_odometer,
  notes,
  archived_at,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const createCloudLocalId = () =>
  `cloud_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const mapCloudVehicleRow = (row: CloudVehicleRow): Vehicle => ({
  ...row,
  odometer_unit: row.odometer_unit as Vehicle["odometer_unit"],
  sync_status: row.sync_status as Vehicle["sync_status"],
  vehicle_type: row.vehicle_type as Vehicle["vehicle_type"],
});

const formatCloudVehicleError = (action: string, error: CloudVehicleError) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase vehicles table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to vehicles. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated table grants and Row Level Security policies are installed.`;
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
    throw new Error("Sign in to use cloud vehicle records.");
  }

  return data.user.id;
};

const toCloudVehiclePayload = (input: VehicleInput): CloudVehiclePayload => ({
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

export const listCloudVehicles = async (): Promise<Vehicle[]> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("vehicles")
    .select(vehicleSelect)
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudVehicleError("Unable to load cloud vehicles", error),
    );
  }

  return (data as CloudVehicleRow[]).map(mapCloudVehicleRow);
};

export const listArchivedCloudVehicles = async (): Promise<Vehicle[]> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("vehicles")
    .select(vehicleSelect)
    .eq("user_id", userId)
    .filter("archived_at", "not.is", "null")
    .order("archived_at", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudVehicleError("Unable to load archived cloud vehicles", error),
    );
  }

  return (data as CloudVehicleRow[]).map(mapCloudVehicleRow);
};

export const getCloudVehicle = async (
  id: string,
  options: { includeArchived?: boolean } = {},
): Promise<Vehicle | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  let query = client
    .from("vehicles")
    .select(vehicleSelect)
    .eq("id", id)
    .eq("user_id", userId);

  if (!options.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(
      formatCloudVehicleError("Unable to load cloud vehicle", error),
    );
  }

  return data ? mapCloudVehicleRow(data as CloudVehicleRow) : null;
};

export const createCloudVehicle = async (
  input: VehicleInput,
): Promise<Vehicle> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const payload: CloudVehiclePayload = {
    ...toCloudVehiclePayload(input),
    initial_odometer: input.current_odometer,
    local_id: createCloudLocalId(),
    sync_status: "synced",
    user_id: userId,
  };
  const { data, error } = await client
    .from("vehicles")
    .insert(payload)
    .select(vehicleSelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudVehicleError("Unable to create cloud vehicle", error),
    );
  }

  return mapCloudVehicleRow(data as CloudVehicleRow);
};

export const updateCloudVehicle = async (
  id: string,
  input: VehicleInput,
): Promise<Vehicle | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudVehicle(id);

  if (!existing) {
    return null;
  }
  const payload: CloudVehiclePayload = {
    ...toCloudVehiclePayload(input),
    initial_odometer: Math.min(
      existing.initial_odometer,
      input.current_odometer,
    ),
  };

  const { data, error } = await client
    .from("vehicles")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .is("archived_at", null)
    .select(vehicleSelect)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudVehicleError("Unable to update cloud vehicle", error),
    );
  }

  return data ? mapCloudVehicleRow(data as CloudVehicleRow) : null;
};

export const archiveCloudVehicle = async (id: string): Promise<void> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();

  const { error } = await client
    .from("vehicles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("archived_at", null);

  if (error) {
    throw new Error(
      formatCloudVehicleError("Unable to archive cloud vehicle", error),
    );
  }
};

export const restoreCloudVehicle = async (id: string): Promise<void> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();

  const { error } = await client
    .from("vehicles")
    .update({ archived_at: null })
    .eq("id", id)
    .eq("user_id", userId)
    .filter("archived_at", "not.is", "null");

  if (error) {
    throw new Error(
      formatCloudVehicleError("Unable to restore cloud vehicle", error),
    );
  }
};
