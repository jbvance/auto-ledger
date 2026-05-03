import { getRecalculatedVehicleOdometer } from "@autoledger/shared";

import { createClient } from "../supabase/server";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

type WebCloudVehicleOdometerRow = {
  current_odometer: number;
  id: string;
  initial_odometer: number;
  odometer_unit: string;
  purchase_odometer: null | number;
};

const formatCloudOdometerRecalculationError = (
  action: string,
  error: SupabaseErrorLike,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase cloud data tables are not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to cloud data. Confirm authenticated grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudOdometerRecalculationError(action, error));
  }
};

export const getWebCloudVehicleForOdometer = async ({
  includeArchived = false,
  userId,
  vehicleId,
}: {
  includeArchived?: boolean;
  userId: string;
  vehicleId: string;
}): Promise<WebCloudVehicleOdometerRow | null> => {
  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select(
      "id, current_odometer, initial_odometer, odometer_unit, purchase_odometer",
    )
    .eq("id", vehicleId)
    .eq("user_id", userId);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query.maybeSingle();

  throwIfError("Unable to load cloud vehicle", error);

  return data as WebCloudVehicleOdometerRow | null;
};

const getHighestCloudOdometerEntryReading = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("odometer_entries")
    .select("reading")
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .order("reading", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(
    "Unable to recalculate cloud odometer from odometer entries",
    error,
  );

  return (data as { reading: number } | null)?.reading;
};

const getHighestCloudServiceRecordReading = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_records")
    .select("odometer_reading")
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .filter("odometer_reading", "not.is", "null")
    .order("odometer_reading", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(
    "Unable to recalculate cloud odometer from service records",
    error,
  );

  return (data as { odometer_reading: number } | null)?.odometer_reading;
};

const getHighestCloudRepairRecordReading = async ({
  userId,
  vehicleId,
}: {
  userId: string;
  vehicleId: string;
}) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_records")
    .select("odometer_reading")
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .filter("odometer_reading", "not.is", "null")
    .order("odometer_reading", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(
    "Unable to recalculate cloud odometer from repair records",
    error,
  );

  return (data as { odometer_reading: number } | null)?.odometer_reading;
};

export const recalculateWebCloudVehicleOdometer = async ({
  includeArchived = false,
  preserveCurrent = false,
  userId,
  vehicleId,
}: {
  includeArchived?: boolean;
  preserveCurrent?: boolean;
  userId: string;
  vehicleId: string;
}) => {
  const vehicle = await getWebCloudVehicleForOdometer({
    includeArchived,
    userId,
    vehicleId,
  });

  if (!vehicle) {
    return;
  }

  const [
    highestOdometerEntryReading,
    highestServiceRecordReading,
    highestRepairRecordReading,
  ] = await Promise.all([
    getHighestCloudOdometerEntryReading({ userId, vehicleId }),
    getHighestCloudServiceRecordReading({ userId, vehicleId }),
    getHighestCloudRepairRecordReading({ userId, vehicleId }),
  ]);
  const recalculatedOdometer = getRecalculatedVehicleOdometer({
    currentOdometer: vehicle.current_odometer,
    initialOdometer: vehicle.initial_odometer,
    odometerEntryReadings: [highestOdometerEntryReading],
    preserveCurrent,
    purchaseOdometer: vehicle.purchase_odometer,
    repairRecordReadings: [highestRepairRecordReading],
    serviceRecordReadings: [highestServiceRecordReading],
  });
  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .update({ current_odometer: recalculatedOdometer })
    .eq("id", vehicleId)
    .eq("user_id", userId);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { error } = await query;

  throwIfError("Unable to update cloud vehicle odometer", error);
};
