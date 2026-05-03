"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createWebCloudOdometerEntry,
  deleteWebCloudOdometerEntry,
  updateWebCloudOdometerEntry,
} from "../../lib/cloud/odometerMutations";
import { getWebCloudAuthState } from "../../lib/cloud/serverData";

export type OdometerEntryFormActionState = {
  error: null | string;
};

export type OdometerEntryDeleteActionState = {
  error: null | string;
};

const getAuthenticatedUserIdForAction = async () => {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    throw new Error(
      authState.errorMessage ?? "Sign in to manage cloud odometer entries.",
    );
  }

  return authState.user.id;
};

const getOdometerEntryInputFromFormData = (formData: FormData) => ({
  notes: formData.get("notes")?.toString() ?? "",
  odometer_unit: formData.get("odometer_unit")?.toString() ?? "",
  reading: formData.get("reading")?.toString() ?? "",
  reading_date: formData.get("reading_date")?.toString() ?? "",
  source_type: formData.get("source_type")?.toString() ?? "manual",
  vehicle_id: formData.get("vehicle_id")?.toString() ?? "",
});

const revalidateOdometerPaths = (vehicleId: string) => {
  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
};

export const createOdometerEntryAction = async (
  _previousState: OdometerEntryFormActionState,
  formData: FormData,
): Promise<OdometerEntryFormActionState> => {
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId) {
    return { error: "Vehicle is missing. Open the vehicle and try again." };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    await createWebCloudOdometerEntry({
      input: getOdometerEntryInputFromFormData(formData),
      userId,
    });
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create this cloud odometer entry.",
    };
  }

  revalidateOdometerPaths(vehicleId);
  redirect(`/vehicles/${vehicleId}#odometer-entries`);
};

export const updateOdometerEntryAction = async (
  _previousState: OdometerEntryFormActionState,
  formData: FormData,
): Promise<OdometerEntryFormActionState> => {
  const entryId = formData.get("entry_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !entryId) {
    return {
      error: "Odometer entry is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const entry = await updateWebCloudOdometerEntry({
      entryId,
      input: getOdometerEntryInputFromFormData(formData),
      userId,
      vehicleId,
    });

    if (!entry) {
      return {
        error:
          "This cloud odometer entry was not found. It may have been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to update this cloud odometer entry.",
    };
  }

  revalidateOdometerPaths(vehicleId);
  redirect(`/vehicles/${vehicleId}#odometer-entries`);
};

export const deleteOdometerEntryAction = async (
  _previousState: OdometerEntryDeleteActionState,
  formData: FormData,
): Promise<OdometerEntryDeleteActionState> => {
  const entryId = formData.get("entry_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !entryId) {
    return {
      error: "Odometer entry is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const deleted = await deleteWebCloudOdometerEntry({
      entryId,
      userId,
      vehicleId,
    });

    if (!deleted) {
      return {
        error:
          "This cloud odometer entry was not found. It may have already been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to delete this cloud odometer entry.",
    };
  }

  revalidateOdometerPaths(vehicleId);
  redirect(`/vehicles/${vehicleId}#odometer-entries`);
};
