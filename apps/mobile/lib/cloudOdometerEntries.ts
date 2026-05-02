import type { OdometerEntry, OdometerEntryInput } from "@autoledger/shared";

import { supabase } from "./supabase";

type CloudOdometerError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type CloudOdometerEntryRow = Omit<
  OdometerEntry,
  "odometer_unit" | "source_type" | "sync_status"
> & {
  odometer_unit: string;
  source_type: string;
  sync_status: string;
  user_id: string;
};

type CloudVehicleOdometerRow = {
  current_odometer: number;
  id: string;
  initial_odometer: number;
  odometer_unit: string;
  purchase_odometer: number | null;
};

type CloudOdometerEntryPayload = {
  local_id?: string;
  notes: string | null;
  odometer_unit: OdometerEntry["odometer_unit"];
  reading: number;
  reading_date: string;
  source_type: OdometerEntry["source_type"];
  sync_status?: OdometerEntry["sync_status"];
  user_id?: string;
  vehicle_id: string;
};

const odometerEntrySelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  reading,
  reading_date,
  odometer_unit,
  source_type,
  notes,
  created_at,
  updated_at,
  sync_status
`;

const optionalText = (value: string | null | undefined) => value ?? null;

const createCloudLocalId = () =>
  `cloud_odo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const mapCloudOdometerEntryRow = (
  row: CloudOdometerEntryRow,
): OdometerEntry => ({
  ...row,
  odometer_unit: row.odometer_unit as OdometerEntry["odometer_unit"],
  source_type: row.source_type as OdometerEntry["source_type"],
  sync_status: row.sync_status as OdometerEntry["sync_status"],
});

const formatCloudOdometerError = (
  action: string,
  error: CloudOdometerError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase odometer_entries table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to odometer entries. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated table grants and Row Level Security policies are installed.`;
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
    throw new Error("Sign in to use cloud odometer entries.");
  }

  return data.user.id;
};

const getCloudVehicleForOdometer = async (
  vehicleId: string,
  userId: string,
): Promise<CloudVehicleOdometerRow | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("vehicles")
    .select(
      "id, current_odometer, initial_odometer, odometer_unit, purchase_odometer",
    )
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudOdometerError("Unable to load cloud vehicle", error),
    );
  }

  return data as CloudVehicleOdometerRow | null;
};

const assertEntryMatchesCloudVehicle = async (
  input: OdometerEntryInput,
  userId: string,
) => {
  const vehicle = await getCloudVehicleForOdometer(input.vehicle_id, userId);

  if (!vehicle) {
    throw new Error("Cloud vehicle not found for this account.");
  }

  if (input.odometer_unit !== vehicle.odometer_unit) {
    throw new Error("Odometer unit must match the cloud vehicle.");
  }

  return vehicle;
};

const toCloudOdometerEntryPayload = (
  input: OdometerEntryInput,
): CloudOdometerEntryPayload => ({
  notes: optionalText(input.notes),
  odometer_unit: input.odometer_unit,
  reading: input.reading,
  reading_date: input.reading_date,
  source_type: input.source_type,
  vehicle_id: input.vehicle_id,
});

const recalculateCloudVehicleOdometer = async (
  vehicleId: string,
  userId: string,
  options: { preserveCurrent?: boolean } = {},
) => {
  const client = requireSupabase();
  const vehicle = await getCloudVehicleForOdometer(vehicleId, userId);

  if (!vehicle) {
    return;
  }

  const { data, error } = await client
    .from("odometer_entries")
    .select("reading")
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .order("reading", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudOdometerError("Unable to recalculate cloud odometer", error),
    );
  }

  const highestReading = (data as { reading: number } | null)?.reading;
  const recalculatedOdometer = Math.max(
    vehicle.initial_odometer,
    options.preserveCurrent
      ? vehicle.current_odometer
      : vehicle.initial_odometer,
    vehicle.purchase_odometer ?? vehicle.initial_odometer,
    highestReading ?? vehicle.initial_odometer,
  );

  const { error: updateError } = await client
    .from("vehicles")
    .update({ current_odometer: recalculatedOdometer })
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .is("archived_at", null);

  if (updateError) {
    throw new Error(
      formatCloudOdometerError(
        "Unable to update cloud vehicle odometer",
        updateError,
      ),
    );
  }
};

export const listCloudOdometerEntries = async (
  vehicleId: string,
): Promise<OdometerEntry[]> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("odometer_entries")
    .select(odometerEntrySelect)
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .order("reading_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudOdometerError("Unable to load cloud odometer entries", error),
    );
  }

  return (data as CloudOdometerEntryRow[]).map(mapCloudOdometerEntryRow);
};

export const getCloudOdometerEntry = async (
  id: string,
): Promise<OdometerEntry | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("odometer_entries")
    .select(odometerEntrySelect)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudOdometerError("Unable to load cloud odometer entry", error),
    );
  }

  return data ? mapCloudOdometerEntryRow(data as CloudOdometerEntryRow) : null;
};

export const createCloudOdometerEntry = async (
  input: OdometerEntryInput,
): Promise<OdometerEntry> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  await assertEntryMatchesCloudVehicle(input, userId);

  const payload: CloudOdometerEntryPayload = {
    ...toCloudOdometerEntryPayload(input),
    local_id: createCloudLocalId(),
    sync_status: "synced",
    user_id: userId,
  };
  const { data, error } = await client
    .from("odometer_entries")
    .insert(payload)
    .select(odometerEntrySelect)
    .single();

  if (error) {
    throw new Error(
      formatCloudOdometerError("Unable to create cloud odometer entry", error),
    );
  }

  await recalculateCloudVehicleOdometer(input.vehicle_id, userId, {
    preserveCurrent: true,
  });

  return mapCloudOdometerEntryRow(data as CloudOdometerEntryRow);
};

export const updateCloudOdometerEntry = async (
  id: string,
  input: OdometerEntryInput,
): Promise<OdometerEntry | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudOdometerEntry(id);

  if (!existing) {
    return null;
  }

  await assertEntryMatchesCloudVehicle(input, userId);

  const { data, error } = await client
    .from("odometer_entries")
    .update(toCloudOdometerEntryPayload(input))
    .eq("id", id)
    .eq("user_id", userId)
    .select(odometerEntrySelect)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudOdometerError("Unable to update cloud odometer entry", error),
    );
  }

  await recalculateCloudVehicleOdometer(existing.vehicle_id, userId);

  if (existing.vehicle_id !== input.vehicle_id) {
    await recalculateCloudVehicleOdometer(input.vehicle_id, userId);
  }

  return data ? mapCloudOdometerEntryRow(data as CloudOdometerEntryRow) : null;
};

export const deleteCloudOdometerEntry = async (id: string): Promise<void> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudOdometerEntry(id);

  if (!existing) {
    return;
  }

  const { error } = await client
    .from("odometer_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      formatCloudOdometerError("Unable to delete cloud odometer entry", error),
    );
  }

  await recalculateCloudVehicleOdometer(existing.vehicle_id, userId);
};
