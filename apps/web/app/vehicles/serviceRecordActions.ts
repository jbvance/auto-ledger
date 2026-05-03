"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createWebCloudServiceRecord,
  deleteWebCloudServiceRecord,
  updateWebCloudServiceRecord,
} from "../../lib/cloud/serviceRecordMutations";
import { getWebCloudAuthState } from "../../lib/cloud/serverData";

export type ServiceRecordFormActionState = {
  error: null | string;
};

export type ServiceRecordDeleteActionState = {
  error: null | string;
};

const getAuthenticatedUserIdForAction = async () => {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    throw new Error(
      authState.errorMessage ?? "Sign in to manage cloud service records.",
    );
  }

  return authState.user.id;
};

const getServiceRecordInputFromFormData = (formData: FormData) => ({
  category: formData.get("category")?.toString() ?? "",
  cost_amount: formData.get("cost_amount")?.toString() ?? "",
  cost_currency: formData.get("cost_currency")?.toString() ?? "USD",
  description: formData.get("description")?.toString() ?? "",
  notes: formData.get("notes")?.toString() ?? "",
  odometer_reading: formData.get("odometer_reading")?.toString() ?? "",
  service_date: formData.get("service_date")?.toString() ?? "",
  title: formData.get("title")?.toString() ?? "",
  vehicle_id: formData.get("vehicle_id")?.toString() ?? "",
  vendor_name: formData.get("vendor_name")?.toString() ?? "",
});

const revalidateServiceRecordPaths = ({
  serviceRecordId,
  vehicleId,
}: {
  serviceRecordId?: string;
  vehicleId: string;
}) => {
  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);

  if (serviceRecordId) {
    revalidatePath(`/vehicles/${vehicleId}/service-records/${serviceRecordId}`);
  }
};

export const createServiceRecordAction = async (
  _previousState: ServiceRecordFormActionState,
  formData: FormData,
): Promise<ServiceRecordFormActionState> => {
  const vehicleId = formData.get("vehicle_id")?.toString();
  let serviceRecordId: null | string = null;

  if (!vehicleId) {
    return { error: "Vehicle is missing. Open the vehicle and try again." };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const serviceRecord = await createWebCloudServiceRecord({
      input: getServiceRecordInputFromFormData(formData),
      userId,
    });
    serviceRecordId = serviceRecord.id;
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create this cloud service record.",
    };
  }

  revalidateServiceRecordPaths({ serviceRecordId, vehicleId });
  redirect(`/vehicles/${vehicleId}/service-records/${serviceRecordId}`);
};

export const updateServiceRecordAction = async (
  _previousState: ServiceRecordFormActionState,
  formData: FormData,
): Promise<ServiceRecordFormActionState> => {
  const serviceRecordId = formData.get("service_record_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !serviceRecordId) {
    return {
      error: "Service record is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const serviceRecord = await updateWebCloudServiceRecord({
      input: getServiceRecordInputFromFormData(formData),
      serviceRecordId,
      userId,
      vehicleId,
    });

    if (!serviceRecord) {
      return {
        error:
          "This cloud service record was not found. It may have been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to update this cloud service record.",
    };
  }

  revalidateServiceRecordPaths({ serviceRecordId, vehicleId });
  redirect(`/vehicles/${vehicleId}/service-records/${serviceRecordId}`);
};

export const deleteServiceRecordAction = async (
  _previousState: ServiceRecordDeleteActionState,
  formData: FormData,
): Promise<ServiceRecordDeleteActionState> => {
  const serviceRecordId = formData.get("service_record_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !serviceRecordId) {
    return {
      error: "Service record is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const deleted = await deleteWebCloudServiceRecord({
      serviceRecordId,
      userId,
      vehicleId,
    });

    if (!deleted) {
      return {
        error:
          "This cloud service record was not found. It may have already been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to delete this cloud service record.",
    };
  }

  revalidateServiceRecordPaths({ serviceRecordId, vehicleId });
  redirect(`/vehicles/${vehicleId}#service-records`);
};
