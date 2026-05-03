"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  completeWebCloudMaintenanceReminder,
  createWebCloudMaintenanceReminder,
  deleteWebCloudMaintenanceReminder,
  updateWebCloudMaintenanceReminder,
} from "../../lib/cloud/maintenanceReminderMutations";
import { getWebCloudAuthState } from "../../lib/cloud/serverData";

export type MaintenanceReminderFormActionState = {
  error: null | string;
};

export type MaintenanceReminderStatusActionState = {
  error: null | string;
};

const getAuthenticatedUserIdForAction = async () => {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    throw new Error(
      authState.errorMessage ?? "Sign in to manage cloud maintenance reminders.",
    );
  }

  return authState.user.id;
};

const getMaintenanceReminderInputFromFormData = (formData: FormData) => ({
  category: formData.get("category")?.toString() ?? "",
  due_date: formData.get("due_date")?.toString() ?? "",
  due_odometer: formData.get("due_odometer")?.toString() ?? "",
  notes: formData.get("notes")?.toString() ?? "",
  reminder_type: formData.get("reminder_type")?.toString() ?? "",
  repeat_interval_miles:
    formData.get("repeat_interval_miles")?.toString() ?? "",
  repeat_interval_months:
    formData.get("repeat_interval_months")?.toString() ?? "",
  title: formData.get("title")?.toString() ?? "",
  vehicle_id: formData.get("vehicle_id")?.toString() ?? "",
});

const revalidateMaintenanceReminderPaths = ({
  reminderId,
  vehicleId,
}: {
  reminderId?: string;
  vehicleId: string;
}) => {
  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);

  if (reminderId) {
    revalidatePath(`/vehicles/${vehicleId}/reminders/${reminderId}`);
  }
};

export const createMaintenanceReminderAction = async (
  _previousState: MaintenanceReminderFormActionState,
  formData: FormData,
): Promise<MaintenanceReminderFormActionState> => {
  const vehicleId = formData.get("vehicle_id")?.toString();
  let reminderId: null | string = null;

  if (!vehicleId) {
    return { error: "Vehicle is missing. Open the vehicle and try again." };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const reminder = await createWebCloudMaintenanceReminder({
      input: getMaintenanceReminderInputFromFormData(formData),
      userId,
    });
    reminderId = reminder.id;
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create this cloud maintenance reminder.",
    };
  }

  revalidateMaintenanceReminderPaths({ reminderId, vehicleId });
  redirect(`/vehicles/${vehicleId}/reminders/${reminderId}`);
};

export const updateMaintenanceReminderAction = async (
  _previousState: MaintenanceReminderFormActionState,
  formData: FormData,
): Promise<MaintenanceReminderFormActionState> => {
  const reminderId = formData.get("reminder_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !reminderId) {
    return {
      error: "Maintenance reminder is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const reminder = await updateWebCloudMaintenanceReminder({
      input: getMaintenanceReminderInputFromFormData(formData),
      reminderId,
      userId,
      vehicleId,
    });

    if (!reminder) {
      return {
        error:
          "This cloud maintenance reminder was not found. It may have been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to update this cloud maintenance reminder.",
    };
  }

  revalidateMaintenanceReminderPaths({ reminderId, vehicleId });
  redirect(`/vehicles/${vehicleId}/reminders/${reminderId}`);
};

export const completeMaintenanceReminderAction = async (
  _previousState: MaintenanceReminderStatusActionState,
  formData: FormData,
): Promise<MaintenanceReminderStatusActionState> => {
  const reminderId = formData.get("reminder_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !reminderId) {
    return {
      error: "Maintenance reminder is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const completed = await completeWebCloudMaintenanceReminder({
      reminderId,
      userId,
      vehicleId,
    });

    if (!completed) {
      return {
        error:
          "This cloud maintenance reminder was not found. It may have already been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete this cloud maintenance reminder.",
    };
  }

  revalidateMaintenanceReminderPaths({ reminderId, vehicleId });
  redirect(`/vehicles/${vehicleId}/reminders/${reminderId}`);
};

export const deleteMaintenanceReminderAction = async (
  _previousState: MaintenanceReminderStatusActionState,
  formData: FormData,
): Promise<MaintenanceReminderStatusActionState> => {
  const reminderId = formData.get("reminder_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();

  if (!vehicleId || !reminderId) {
    return {
      error: "Maintenance reminder is missing. Open the vehicle and try again.",
    };
  }

  try {
    const userId = await getAuthenticatedUserIdForAction();
    const deleted = await deleteWebCloudMaintenanceReminder({
      reminderId,
      userId,
      vehicleId,
    });

    if (!deleted) {
      return {
        error:
          "This cloud maintenance reminder was not found. It may have already been deleted or belong to another account.",
      };
    }
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to delete this cloud maintenance reminder.",
    };
  }

  revalidateMaintenanceReminderPaths({ reminderId, vehicleId });
  redirect(`/vehicles/${vehicleId}#maintenance-reminders`);
};
