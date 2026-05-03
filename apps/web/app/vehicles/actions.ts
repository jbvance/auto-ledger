"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  archiveWebCloudVehicle,
  createWebCloudVehicle,
  restoreWebCloudVehicle,
  updateWebCloudVehicle,
} from "../../lib/cloud/vehicleMutations";
import { getWebCloudAuthState } from "../../lib/cloud/serverData";

export type VehicleFormActionState = {
  error: null | string;
};

export type VehicleStatusActionState = {
  error: null | string;
};

const getAuthenticatedUserIdForAction = async () => {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    throw new Error(
      authState.errorMessage ?? "Sign in to manage cloud vehicles.",
    );
  }

  return authState.user.id;
};

const getVehicleInputFromFormData = (formData: FormData) => ({
  color: formData.get("color")?.toString() ?? "",
  current_odometer: formData.get("current_odometer")?.toString() ?? "",
  license_plate: formData.get("license_plate")?.toString() ?? "",
  license_state: formData.get("license_state")?.toString() ?? "",
  make: formData.get("make")?.toString() ?? "",
  model: formData.get("model")?.toString() ?? "",
  nickname: formData.get("nickname")?.toString() ?? "",
  notes: formData.get("notes")?.toString() ?? "",
  odometer_unit: formData.get("odometer_unit")?.toString() ?? "",
  purchase_date: formData.get("purchase_date")?.toString() ?? "",
  purchase_odometer: formData.get("purchase_odometer")?.toString() ?? "",
  trim: formData.get("trim")?.toString() ?? "",
  vehicle_type: formData.get("vehicle_type")?.toString() ?? "",
  vin: formData.get("vin")?.toString() ?? "",
  year: formData.get("year")?.toString() ?? "",
});

export const createVehicleAction = async (
  _previousState: VehicleFormActionState,
  formData: FormData,
): Promise<VehicleFormActionState> => {
  let vehicleId: null | string = null;

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const vehicle = await createWebCloudVehicle({
      input: getVehicleInputFromFormData(formData),
      userId,
    });
    vehicleId = vehicle.id;
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create this cloud vehicle.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicleId}`);
};

export const updateVehicleAction = async (
  _previousState: VehicleFormActionState,
  formData: FormData,
): Promise<VehicleFormActionState> => {
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId) {
    return { error: "Vehicle is missing. Open the vehicle and try again." };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const vehicle = await updateWebCloudVehicle({
      input: getVehicleInputFromFormData(formData),
      userId,
      vehicleId,
    });

    if (!vehicle) {
      return {
        error:
          "This active cloud vehicle was not found. It may be archived or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to update this cloud vehicle.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}`);
};

export const archiveVehicleAction = async (
  _previousState: VehicleStatusActionState,
  formData: FormData,
): Promise<VehicleStatusActionState> => {
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId) {
    return { error: "Vehicle is missing. Open the vehicle and try again." };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const archived = await archiveWebCloudVehicle({ userId, vehicleId });

    if (!archived) {
      return {
        error:
          "This active cloud vehicle was not found. It may already be archived or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to archive this cloud vehicle.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect("/vehicles");
};

export const restoreVehicleAction = async (
  _previousState: VehicleStatusActionState,
  formData: FormData,
): Promise<VehicleStatusActionState> => {
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId) {
    return { error: "Vehicle is missing. Open the vehicle and try again." };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const restored = await restoreWebCloudVehicle({ userId, vehicleId });

    if (!restored) {
      return {
        error:
          "This archived cloud vehicle was not found. It may already be active or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to restore this cloud vehicle.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}`);
};
