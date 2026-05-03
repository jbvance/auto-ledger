"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createWebCloudRepairRecord,
  deleteWebCloudRepairRecord,
  updateWebCloudRepairRecord,
} from "../../lib/cloud/repairRecordMutations";
import { getWebCloudAuthState } from "../../lib/cloud/serverData";

export type RepairRecordFormActionState = {
  error: null | string;
};

export type RepairRecordDeleteActionState = {
  error: null | string;
};

const getAuthenticatedUserIdForAction = async () => {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    throw new Error(
      authState.errorMessage ?? "Sign in to manage cloud repair records.",
    );
  }

  return authState.user.id;
};

const getRepairRecordInputFromFormData = (formData: FormData) => ({
  category: formData.get("category")?.toString() ?? "",
  cost_amount: formData.get("cost_amount")?.toString() ?? "",
  cost_currency: formData.get("cost_currency")?.toString() ?? "USD",
  description: formData.get("description")?.toString() ?? "",
  notes: formData.get("notes")?.toString() ?? "",
  odometer_reading: formData.get("odometer_reading")?.toString() ?? "",
  repair_date: formData.get("repair_date")?.toString() ?? "",
  title: formData.get("title")?.toString() ?? "",
  vehicle_id: formData.get("vehicle_id")?.toString() ?? "",
  vendor_name: formData.get("vendor_name")?.toString() ?? "",
  warranty_until_date:
    formData.get("warranty_until_date")?.toString() ?? "",
  warranty_until_odometer:
    formData.get("warranty_until_odometer")?.toString() ?? "",
});

const revalidateRepairRecordPaths = ({
  repairRecordId,
  vehicleId,
}: {
  repairRecordId?: string;
  vehicleId: string;
}) => {
  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);

  if (repairRecordId) {
    revalidatePath(`/vehicles/${vehicleId}/repair-records/${repairRecordId}`);
  }
};

export const createRepairRecordAction = async (
  _previousState: RepairRecordFormActionState,
  formData: FormData,
): Promise<RepairRecordFormActionState> => {
  const vehicleId = formData.get("vehicle_id")?.toString();
  let repairRecordId: null | string = null;

  if (!vehicleId) {
    return { error: "Vehicle is missing. Open the vehicle and try again." };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const repairRecord = await createWebCloudRepairRecord({
      input: getRepairRecordInputFromFormData(formData),
      userId,
    });
    repairRecordId = repairRecord.id;
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create this cloud repair record.",
    };
  }

  revalidateRepairRecordPaths({ repairRecordId, vehicleId });
  redirect(`/vehicles/${vehicleId}/repair-records/${repairRecordId}`);
};

export const updateRepairRecordAction = async (
  _previousState: RepairRecordFormActionState,
  formData: FormData,
): Promise<RepairRecordFormActionState> => {
  const repairRecordId = formData.get("repair_record_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !repairRecordId) {
    return {
      error: "Repair record is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const repairRecord = await updateWebCloudRepairRecord({
      input: getRepairRecordInputFromFormData(formData),
      repairRecordId,
      userId,
      vehicleId,
    });

    if (!repairRecord) {
      return {
        error:
          "This cloud repair record was not found. It may have been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to update this cloud repair record.",
    };
  }

  revalidateRepairRecordPaths({ repairRecordId, vehicleId });
  redirect(`/vehicles/${vehicleId}/repair-records/${repairRecordId}`);
};

export const deleteRepairRecordAction = async (
  _previousState: RepairRecordDeleteActionState,
  formData: FormData,
): Promise<RepairRecordDeleteActionState> => {
  const repairRecordId = formData.get("repair_record_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !repairRecordId) {
    return {
      error: "Repair record is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const deleted = await deleteWebCloudRepairRecord({
      repairRecordId,
      userId,
      vehicleId,
    });

    if (!deleted) {
      return {
        error:
          "This cloud repair record was not found. It may have already been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to delete this cloud repair record.",
    };
  }

  revalidateRepairRecordPaths({ repairRecordId, vehicleId });
  redirect(`/vehicles/${vehicleId}#repair-records`);
};
