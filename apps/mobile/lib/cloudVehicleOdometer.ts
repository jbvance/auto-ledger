import { supabase } from "./supabase";

type CloudOdometerRecalculationError = {
  code?: string;
  message: string;
};

type CloudVehicleOdometerRow = {
  current_odometer: number;
  id: string;
  initial_odometer: number;
  odometer_unit: string;
  purchase_odometer: number | null;
};

const formatCloudOdometerRecalculationError = (
  action: string,
  error: CloudOdometerRecalculationError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase cloud data tables are not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to cloud data. Rerun packages/db/sql/002_cloud_data_schema_rls.sql so authenticated table grants and Row Level Security policies are installed.`;
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

export const getCloudVehicleForOdometer = async (
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
      formatCloudOdometerRecalculationError(
        "Unable to load cloud vehicle",
        error,
      ),
    );
  }

  return data as CloudVehicleOdometerRow | null;
};

const getHighestCloudOdometerEntryReading = async (
  vehicleId: string,
  userId: string,
) => {
  const client = requireSupabase();
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
      formatCloudOdometerRecalculationError(
        "Unable to recalculate cloud odometer from odometer entries",
        error,
      ),
    );
  }

  return (data as { reading: number } | null)?.reading;
};

const getHighestCloudServiceRecordReading = async (
  vehicleId: string,
  userId: string,
) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("service_records")
    .select("odometer_reading")
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .filter("odometer_reading", "not.is", "null")
    .order("odometer_reading", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudOdometerRecalculationError(
        "Unable to recalculate cloud odometer from service records",
        error,
      ),
    );
  }

  return (data as { odometer_reading: number } | null)?.odometer_reading;
};

export const recalculateCloudVehicleOdometer = async (
  vehicleId: string,
  userId: string,
  options: { preserveCurrent?: boolean } = {},
) => {
  const client = requireSupabase();
  const vehicle = await getCloudVehicleForOdometer(vehicleId, userId);

  if (!vehicle) {
    return;
  }

  const [highestOdometerEntryReading, highestServiceRecordReading] =
    await Promise.all([
      getHighestCloudOdometerEntryReading(vehicleId, userId),
      getHighestCloudServiceRecordReading(vehicleId, userId),
    ]);
  const recalculatedOdometer = Math.max(
    vehicle.initial_odometer,
    options.preserveCurrent
      ? vehicle.current_odometer
      : vehicle.initial_odometer,
    vehicle.purchase_odometer ?? vehicle.initial_odometer,
    highestOdometerEntryReading ?? vehicle.initial_odometer,
    highestServiceRecordReading ?? vehicle.initial_odometer,
  );

  const { error } = await client
    .from("vehicles")
    .update({ current_odometer: recalculatedOdometer })
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .is("archived_at", null);

  if (error) {
    throw new Error(
      formatCloudOdometerRecalculationError(
        "Unable to update cloud vehicle odometer",
        error,
      ),
    );
  }
};
