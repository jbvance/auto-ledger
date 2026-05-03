"use server";

import { revalidatePath } from "next/cache";

import {
  deleteWebCloudAttachment,
  uploadWebCloudAttachmentForRepairRecord,
  uploadWebCloudAttachmentForServiceRecord,
} from "../../lib/cloud/recordAttachmentData";
import { getWebCloudAuthState } from "../../lib/cloud/serverData";

export type RecordAttachmentUploadActionState = {
  error: null | string;
  message: null | string;
  revision: number;
  status: "idle" | "success";
};

export type RecordAttachmentDeleteActionState = {
  error: null | string;
  message: null | string;
  revision: number;
  status: "idle" | "success";
};

const getAuthenticatedUserIdForAction = async () => {
  const authState = await getWebCloudAuthState();

  if (authState.status !== "authenticated") {
    throw new Error(
      authState.errorMessage ?? "Sign in to manage cloud attachments.",
    );
  }

  return authState.user.id;
};

const getRequiredFormValue = (formData: FormData, key: string) => {
  const value = formData.get(key)?.toString().trim();

  if (!value) {
    throw new Error("Attachment details are missing. Refresh and try again.");
  }

  return value;
};

const getAttachmentFile = (formData: FormData) => {
  const file = formData.get("attachment_file");

  if (!(file instanceof File)) {
    throw new Error("Choose a photo or PDF to upload.");
  }

  return file;
};

const revalidateAttachmentPaths = ({
  repairRecordId,
  serviceRecordId,
  vehicleId,
}: {
  repairRecordId?: string;
  serviceRecordId?: string;
  vehicleId: string;
}) => {
  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);

  if (serviceRecordId) {
    revalidatePath(`/vehicles/${vehicleId}/service-records/${serviceRecordId}`);
  }

  if (repairRecordId) {
    revalidatePath(`/vehicles/${vehicleId}/repair-records/${repairRecordId}`);
  }
};

const successState = (
  message: string,
): RecordAttachmentDeleteActionState | RecordAttachmentUploadActionState => ({
  error: null,
  message,
  revision: Date.now(),
  status: "success",
});

const errorState = (
  error: unknown,
): RecordAttachmentDeleteActionState | RecordAttachmentUploadActionState => ({
  error:
    error instanceof Error
      ? error.message
      : "Unable to update this cloud attachment.",
  message: null,
  revision: Date.now(),
  status: "idle",
});

export const uploadServiceRecordAttachmentAction = async (
  _previousState: RecordAttachmentUploadActionState,
  formData: FormData,
): Promise<RecordAttachmentUploadActionState> => {
  try {
    const userId = await getAuthenticatedUserIdForAction();
    const vehicleId = getRequiredFormValue(formData, "vehicle_id");
    const serviceRecordId = getRequiredFormValue(formData, "service_record_id");
    const attachment = await uploadWebCloudAttachmentForServiceRecord({
      file: getAttachmentFile(formData),
      serviceRecordId,
      userId,
      vehicleId,
    });

    if (!attachment) {
      return {
        error:
          "This cloud service record was not found. It may have been deleted or belong to another account.",
        message: null,
        revision: Date.now(),
        status: "idle",
      };
    }

    revalidateAttachmentPaths({ serviceRecordId, vehicleId });

    return successState("Attachment uploaded.");
  } catch (error: unknown) {
    return errorState(error);
  }
};

export const uploadRepairRecordAttachmentAction = async (
  _previousState: RecordAttachmentUploadActionState,
  formData: FormData,
): Promise<RecordAttachmentUploadActionState> => {
  try {
    const userId = await getAuthenticatedUserIdForAction();
    const vehicleId = getRequiredFormValue(formData, "vehicle_id");
    const repairRecordId = getRequiredFormValue(formData, "repair_record_id");
    const attachment = await uploadWebCloudAttachmentForRepairRecord({
      file: getAttachmentFile(formData),
      repairRecordId,
      userId,
      vehicleId,
    });

    if (!attachment) {
      return {
        error:
          "This cloud repair record was not found. It may have been deleted or belong to another account.",
        message: null,
        revision: Date.now(),
        status: "idle",
      };
    }

    revalidateAttachmentPaths({ repairRecordId, vehicleId });

    return successState("Attachment uploaded.");
  } catch (error: unknown) {
    return errorState(error);
  }
};

export const deleteServiceRecordAttachmentAction = async (
  _previousState: RecordAttachmentDeleteActionState,
  formData: FormData,
): Promise<RecordAttachmentDeleteActionState> => {
  try {
    const userId = await getAuthenticatedUserIdForAction();
    const attachmentId = getRequiredFormValue(formData, "attachment_id");
    const vehicleId = getRequiredFormValue(formData, "vehicle_id");
    const serviceRecordId = getRequiredFormValue(formData, "service_record_id");
    const deleted = await deleteWebCloudAttachment({
      attachmentId,
      serviceRecordId,
      userId,
      vehicleId,
    });

    if (!deleted) {
      return {
        error:
          "This cloud attachment was not found for this service record. It may already be deleted.",
        message: null,
        revision: Date.now(),
        status: "idle",
      };
    }

    revalidateAttachmentPaths({ serviceRecordId, vehicleId });

    return successState("Attachment deleted.");
  } catch (error: unknown) {
    return errorState(error);
  }
};

export const deleteRepairRecordAttachmentAction = async (
  _previousState: RecordAttachmentDeleteActionState,
  formData: FormData,
): Promise<RecordAttachmentDeleteActionState> => {
  try {
    const userId = await getAuthenticatedUserIdForAction();
    const attachmentId = getRequiredFormValue(formData, "attachment_id");
    const vehicleId = getRequiredFormValue(formData, "vehicle_id");
    const repairRecordId = getRequiredFormValue(formData, "repair_record_id");
    const deleted = await deleteWebCloudAttachment({
      attachmentId,
      repairRecordId,
      userId,
      vehicleId,
    });

    if (!deleted) {
      return {
        error:
          "This cloud attachment was not found for this repair record. It may already be deleted.",
        message: null,
        revision: Date.now(),
        status: "idle",
      };
    }

    revalidateAttachmentPaths({ repairRecordId, vehicleId });

    return successState("Attachment deleted.");
  } catch (error: unknown) {
    return errorState(error);
  }
};
