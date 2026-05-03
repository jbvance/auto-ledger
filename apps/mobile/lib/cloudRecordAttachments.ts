import {
  getRecordAttachmentStoragePath,
  recordAttachmentFileSizeLimitLabels,
  recordAttachmentFileSizeLimits,
  recordAttachmentStorageBucket,
  type RecordAttachment,
  type RecordAttachmentInput,
  type RecordAttachmentRecordType,
} from "@autoledger/shared";
import { recordAttachmentSchema } from "@autoledger/validation";
import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "./supabase";

type CloudRecordAttachmentError = {
  code?: string;
  message: string;
};

export type CloudRecordAttachmentRow = Omit<
  RecordAttachment,
  "file_type" | "ocr_status" | "sync_status"
> & {
  file_type: string;
  ocr_status: string;
  sync_status: string;
  user_id: string;
};

export type CloudAttachmentParentRecord = {
  id: string;
  user_id: string;
  vehicle_id: string;
};

export type CloudRecordAttachmentPayload = {
  created_at?: string;
  file_name: string;
  file_size_bytes: number | null;
  file_type: RecordAttachment["file_type"];
  local_id: string;
  local_uri: null;
  mime_type: string;
  ocr_processed_at?: string | null;
  ocr_status: RecordAttachment["ocr_status"];
  ocr_text?: string | null;
  ocr_vendor?: string | null;
  repair_record_id: string | null;
  service_record_id: string | null;
  storage_bucket: string;
  storage_path: string;
  sync_status: RecordAttachment["sync_status"];
  updated_at?: string;
  user_id: string;
  vehicle_id: string;
};

type CreateCloudAttachmentOptions = {
  localId?: string;
};

type BuildCloudRecordAttachmentPayloadInput = {
  input: RecordAttachmentInput;
  localId: string;
  parentRecord: CloudAttachmentParentRecord;
  recordType: RecordAttachmentRecordType;
  uploadedSize?: number | null;
};

export type CloudRecordAttachmentDuplicateStatus =
  | "already_migrated"
  | "conflicting_duplicate"
  | "not_found";

export type CloudRecordAttachmentDuplicateState = {
  reason: string | null;
  status: CloudRecordAttachmentDuplicateStatus;
};

export type CloudRecordAttachmentMetadataWriteStatus =
  | "metadata_insert_failed_cleanup_failed"
  | "metadata_insert_failed_cleanup_succeeded"
  | "saved";

export type CloudRecordAttachmentMetadataWriteResult =
  | {
      attachment: RecordAttachment;
      cleanupErrorMessage: null;
      errorMessage: null;
      status: "saved";
      storageBucket: string;
      storagePath: string;
    }
  | {
      attachment: null;
      cleanupErrorMessage: null;
      errorMessage: string;
      status: "metadata_insert_failed_cleanup_succeeded";
      storageBucket: string;
      storagePath: string;
    }
  | {
      attachment: null;
      cleanupErrorMessage: string;
      errorMessage: string;
      status: "metadata_insert_failed_cleanup_failed";
      storageBucket: string;
      storagePath: string;
    };

export type LocalAttachmentFileAvailability =
  | {
      errorMessage: null;
      fileSizeBytes: number | null;
      isAvailable: true;
      localUri: string;
    }
  | {
      errorMessage: string;
      fileSizeBytes: number | null;
      isAvailable: false;
      localUri: string;
    };

export const cloudRecordAttachmentSelect = `
  id,
  user_id,
  vehicle_id,
  service_record_id,
  repair_record_id,
  local_id,
  file_name,
  file_type,
  mime_type,
  file_size_bytes,
  storage_bucket,
  storage_path,
  local_uri,
  ocr_status,
  ocr_text,
  ocr_vendor,
  ocr_processed_at,
  created_at,
  updated_at,
  sync_status
`;

const createCloudLocalId = () =>
  `cloud_att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const resolveAttachmentLocalId = (localId?: string) => {
  const nextLocalId = localId ?? createCloudLocalId();

  if (!nextLocalId.trim()) {
    throw new Error("Attachment local ID is required.");
  }

  return nextLocalId;
};

const base64Characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const decodeBase64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const cleanedBase64 = base64.replace(/[\r\n\s]/g, "").replace(/=+$/, "");
  const bytes: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  for (const character of cleanedBase64) {
    const value = base64Characters.indexOf(character);

    if (value < 0) {
      continue;
    }

    bitBuffer = (bitBuffer << 6) | value;
    bitCount += 6;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bitBuffer >> bitCount) & 0xff);
    }
  }

  return Uint8Array.from(bytes).buffer;
};

export const mapCloudRecordAttachmentRow = (
  row: CloudRecordAttachmentRow,
): RecordAttachment => ({
  ...row,
  file_size_bytes:
    row.file_size_bytes === null || row.file_size_bytes === undefined
      ? row.file_size_bytes
      : Number(row.file_size_bytes),
  file_type: row.file_type as RecordAttachment["file_type"],
  ocr_status: row.ocr_status as RecordAttachment["ocr_status"],
  sync_status: row.sync_status as RecordAttachment["sync_status"],
});

export const buildCloudRecordAttachmentPayload = ({
  input,
  localId,
  parentRecord,
  recordType,
  uploadedSize = null,
}: BuildCloudRecordAttachmentPayloadInput): CloudRecordAttachmentPayload => {
  const storagePath = getRecordAttachmentStoragePath({
    attachmentId: localId,
    fileName: input.file_name,
    recordId: parentRecord.id,
    recordType,
    userId: parentRecord.user_id,
    vehicleId: parentRecord.vehicle_id,
  });

  return {
    file_name: input.file_name,
    file_size_bytes: input.file_size_bytes ?? uploadedSize ?? null,
    file_type: input.file_type,
    local_id: localId,
    local_uri: null,
    mime_type: input.mime_type,
    ocr_status: "not_started",
    repair_record_id: recordType === "repair" ? parentRecord.id : null,
    service_record_id: recordType === "service" ? parentRecord.id : null,
    storage_bucket: recordAttachmentStorageBucket,
    storage_path: storagePath,
    sync_status: "synced",
    user_id: parentRecord.user_id,
    vehicle_id: parentRecord.vehicle_id,
  };
};

const valuesMatch = ({
  existing,
  expected,
  field,
}: {
  existing: number | string | null | undefined;
  expected: number | string | null | undefined;
  field: string;
}) => {
  if (field === "file_size_bytes" && expected === null) {
    return true;
  }

  return (existing ?? null) === (expected ?? null);
};

export const getCloudRecordAttachmentDuplicateState = ({
  existing,
  expected,
}: {
  existing: RecordAttachment | null;
  expected: CloudRecordAttachmentPayload;
}): CloudRecordAttachmentDuplicateState => {
  if (!existing) {
    return {
      reason: null,
      status: "not_found",
    };
  }

  const expectedFields: Array<
    [
      keyof Pick<
        RecordAttachment,
        | "file_name"
        | "file_size_bytes"
        | "file_type"
        | "local_id"
        | "mime_type"
        | "repair_record_id"
        | "service_record_id"
        | "storage_bucket"
        | "storage_path"
        | "vehicle_id"
      >,
      number | string | null,
    ]
  > = [
    ["local_id", expected.local_id],
    ["vehicle_id", expected.vehicle_id],
    ["service_record_id", expected.service_record_id],
    ["repair_record_id", expected.repair_record_id],
    ["file_name", expected.file_name],
    ["file_type", expected.file_type],
    ["mime_type", expected.mime_type],
    ["file_size_bytes", expected.file_size_bytes],
    ["storage_bucket", expected.storage_bucket],
    ["storage_path", expected.storage_path],
  ];
  const mismatchedField = expectedFields.find(
    ([field, expectedValue]) =>
      !valuesMatch({
        existing: existing[field],
        expected: expectedValue,
        field,
      }),
  )?.[0];

  if (mismatchedField) {
    return {
      reason: `Existing cloud attachment with local_id "${expected.local_id}" does not match expected ${mismatchedField}.`,
      status: "conflicting_duplicate",
    };
  }

  return {
    reason: null,
    status: "already_migrated",
  };
};

const formatCloudRecordAttachmentError = (
  action: string,
  error: CloudRecordAttachmentError,
) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase record_attachments table is not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql and packages/db/sql/003_record_attachments_storage_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("bucket not found")) {
    return `${action}. The private record-attachments Storage bucket is not available yet. Run packages/db/sql/003_record_attachments_storage_rls.sql in Supabase.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access to attachment storage or metadata. Confirm Storage RLS and record attachment RLS policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const getFileSizeLimitMessage = (
  fileType: RecordAttachment["file_type"],
  fileSizeBytes: number | null | undefined,
) => {
  if (
    fileSizeBytes === null ||
    fileSizeBytes === undefined ||
    fileSizeBytes <= recordAttachmentFileSizeLimits[fileType]
  ) {
    return null;
  }

  return `${fileType === "photo" ? "Photo" : "PDF"} attachments must be ${recordAttachmentFileSizeLimitLabels[fileType]} or smaller.`;
};

export const verifyLocalAttachmentFileForUpload = async ({
  fileType,
  localUri,
}: {
  fileType: RecordAttachment["file_type"];
  localUri: string | null | undefined;
}): Promise<LocalAttachmentFileAvailability> => {
  const normalizedUri = localUri?.trim() ?? "";

  if (!normalizedUri) {
    return {
      errorMessage: "Attachment file URI is missing.",
      fileSizeBytes: null,
      isAvailable: false,
      localUri: normalizedUri,
    };
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(normalizedUri);

    if (!fileInfo.exists) {
      return {
        errorMessage: "Attachment file is no longer available on this device.",
        fileSizeBytes: null,
        isAvailable: false,
        localUri: normalizedUri,
      };
    }

    const fileSizeBytes =
      "size" in fileInfo && typeof fileInfo.size === "number"
        ? fileInfo.size
        : null;

    if (fileSizeBytes !== null && fileSizeBytes <= 0) {
      return {
        errorMessage: "Attachment file is empty.",
        fileSizeBytes,
        isAvailable: false,
        localUri: normalizedUri,
      };
    }

    const fileSizeLimitMessage = getFileSizeLimitMessage(
      fileType,
      fileSizeBytes,
    );

    if (fileSizeLimitMessage) {
      return {
        errorMessage: fileSizeLimitMessage,
        fileSizeBytes,
        isAvailable: false,
        localUri: normalizedUri,
      };
    }

    return {
      errorMessage: null,
      fileSizeBytes,
      isAvailable: true,
      localUri: normalizedUri,
    };
  } catch (error: unknown) {
    return {
      errorMessage:
        error instanceof Error && error.message
          ? `Attachment file could not be checked before upload. ${error.message}`
          : "Attachment file could not be checked before upload.",
      fileSizeBytes: null,
      isAvailable: false,
      localUri: normalizedUri,
    };
  }
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
    throw new Error("Sign in to use cloud attachments.");
  }

  return data.user.id;
};

const getCloudServiceRecordForAttachment = async (
  serviceRecordId: string,
  userId: string,
): Promise<CloudAttachmentParentRecord | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("service_records")
    .select("id, user_id, vehicle_id")
    .eq("id", serviceRecordId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError(
        "Unable to verify cloud service record",
        error,
      ),
    );
  }

  return data as CloudAttachmentParentRecord | null;
};

const getCloudRepairRecordForAttachment = async (
  repairRecordId: string,
  userId: string,
): Promise<CloudAttachmentParentRecord | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("repair_records")
    .select("id, user_id, vehicle_id")
    .eq("id", repairRecordId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError(
        "Unable to verify cloud repair record",
        error,
      ),
    );
  }

  return data as CloudAttachmentParentRecord | null;
};

const getCloudAttachment = async (
  id: string,
): Promise<RecordAttachment | null> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("record_attachments")
    .select(cloudRecordAttachmentSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError("Unable to load cloud attachment", error),
    );
  }

  return data
    ? mapCloudRecordAttachmentRow(data as CloudRecordAttachmentRow)
    : null;
};

export const getCloudAttachmentByLocalIdForUser = async ({
  localId,
  userId,
}: {
  localId: string;
  userId: string;
}): Promise<RecordAttachment | null> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("record_attachments")
    .select(cloudRecordAttachmentSelect)
    .eq("user_id", userId)
    .eq("local_id", localId)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError(
        "Unable to check migrated attachment metadata",
        error,
      ),
    );
  }

  return data
    ? mapCloudRecordAttachmentRow(data as CloudRecordAttachmentRow)
    : null;
};

export type StorageUploadResult = {
  sizeBytes: number;
  status: "already_exists" | "uploaded";
};

export const uploadLocalFileToStorage = async ({
  allowExistingObject = false,
  contentType,
  fileType,
  localUri,
  path,
}: {
  allowExistingObject?: boolean;
  contentType: string;
  fileType: RecordAttachment["file_type"];
  localUri: string;
  path: string;
}): Promise<StorageUploadResult> => {
  const client = requireSupabase();
  const availability = await verifyLocalAttachmentFileForUpload({
    fileType,
    localUri,
  });
  let body: ArrayBuffer;

  if (!availability.isAvailable) {
    throw new Error(availability.errorMessage);
  }

  try {
    const base64File = await FileSystem.readAsStringAsync(
      availability.localUri,
      {
      encoding: FileSystem.EncodingType.Base64,
      },
    );
    body = decodeBase64ToArrayBuffer(base64File);
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error && error.message
        ? `Unable to read the selected file for upload. ${error.message}`
        : "Unable to read the selected file for upload.",
    );
  }

  if (body.byteLength <= 0) {
    throw new Error("Unable to read the selected file for upload.");
  }

  const bodySizeLimitMessage = getFileSizeLimitMessage(fileType, body.byteLength);

  if (bodySizeLimitMessage) {
    throw new Error(bodySizeLimitMessage);
  }

  const { error } = await client.storage
    .from(recordAttachmentStorageBucket)
    .upload(path, body, {
      contentType,
      upsert: false,
    });

  if (error) {
    const lowerMessage = error.message.toLowerCase();

    if (
      allowExistingObject &&
      (lowerMessage.includes("already exists") ||
        lowerMessage.includes("duplicate") ||
        lowerMessage.includes("resource already exists"))
    ) {
      return {
        sizeBytes: body.byteLength,
        status: "already_exists",
      };
    }

    throw new Error(
      formatCloudRecordAttachmentError("Unable to upload attachment", error),
    );
  }

  return {
    sizeBytes: body.byteLength,
    status: "uploaded",
  };
};

const removeStorageObject = async (
  storagePath: string,
  storageBucket = recordAttachmentStorageBucket,
) => {
  const client = requireSupabase();
  const { error } = await client.storage
    .from(storageBucket)
    .remove([storagePath]);

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError(
        "Unable to delete the attachment file",
        error,
      ),
    );
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "Unknown attachment error.";

export const insertCloudAttachmentMetadataWithUploadCleanup = async ({
  payload,
  storageBucket = payload.storage_bucket,
  storagePath = payload.storage_path,
}: {
  payload: CloudRecordAttachmentPayload;
  storageBucket?: string;
  storagePath?: string;
}): Promise<CloudRecordAttachmentMetadataWriteResult> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("record_attachments")
    .insert(payload)
    .select(cloudRecordAttachmentSelect)
    .single();

  if (!error) {
    return {
      attachment: mapCloudRecordAttachmentRow(data as CloudRecordAttachmentRow),
      cleanupErrorMessage: null,
      errorMessage: null,
      status: "saved",
      storageBucket,
      storagePath,
    };
  }

  const errorMessage = formatCloudRecordAttachmentError(
    "Attachment uploaded, but metadata could not be saved",
    error,
  );

  try {
    await removeStorageObject(storagePath, storageBucket);

    return {
      attachment: null,
      cleanupErrorMessage: null,
      errorMessage,
      status: "metadata_insert_failed_cleanup_succeeded",
      storageBucket,
      storagePath,
    };
  } catch (cleanupError: unknown) {
    const cleanupErrorMessage = getErrorMessage(cleanupError);

    console.warn(
      "Unable to clean up uploaded attachment after metadata failure.",
      cleanupError,
    );

    return {
      attachment: null,
      cleanupErrorMessage,
      errorMessage,
      status: "metadata_insert_failed_cleanup_failed",
      storageBucket,
      storagePath,
    };
  }
};

export const getCloudRecordAttachmentMetadataWriteErrorMessage = (
  result: CloudRecordAttachmentMetadataWriteResult,
) => {
  if (result.status === "saved") {
    return null;
  }

  if (result.status === "metadata_insert_failed_cleanup_failed") {
    return `${result.errorMessage} The uploaded file could not be cleaned up automatically, so retry may need to reuse or remove ${result.storagePath}.`;
  }

  return result.errorMessage;
};

const createCloudAttachment = async ({
  input,
  options,
  parentRecord,
  recordType,
}: {
  input: RecordAttachmentInput;
  options?: CreateCloudAttachmentOptions;
  parentRecord: CloudAttachmentParentRecord;
  recordType: RecordAttachmentRecordType;
}): Promise<RecordAttachment> => {
  const validation = recordAttachmentSchema.safeParse(input);

  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ??
        "Attachment details could not be validated.",
    );
  }

  const validatedInput = validation.data;

  if (validatedInput.vehicle_id !== parentRecord.vehicle_id) {
    throw new Error("Attachment vehicle must match the cloud record.");
  }

  const localId = resolveAttachmentLocalId(options?.localId);
  const storagePath = getRecordAttachmentStoragePath({
    attachmentId: localId,
    fileName: validatedInput.file_name,
    recordId: parentRecord.id,
    recordType,
    userId: parentRecord.user_id,
    vehicleId: parentRecord.vehicle_id,
  });
  const uploadResult = await uploadLocalFileToStorage({
    contentType: validatedInput.mime_type,
    fileType: validatedInput.file_type,
    localUri: validatedInput.local_uri,
    path: storagePath,
  });
  const payload = buildCloudRecordAttachmentPayload({
    input: validatedInput,
    localId,
    parentRecord,
    recordType,
    uploadedSize: uploadResult.sizeBytes,
  });

  const metadataWriteResult =
    await insertCloudAttachmentMetadataWithUploadCleanup({
      payload,
      storagePath,
    });

  if (metadataWriteResult.status !== "saved") {
    throw new Error(
      getCloudRecordAttachmentMetadataWriteErrorMessage(metadataWriteResult) ??
        "Attachment uploaded, but metadata could not be saved.",
    );
  }

  return metadataWriteResult.attachment;
};

export const listCloudAttachmentsForServiceRecord = async (
  serviceRecordId: string,
): Promise<RecordAttachment[]> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("record_attachments")
    .select(cloudRecordAttachmentSelect)
    .eq("service_record_id", serviceRecordId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError(
        "Unable to load cloud service attachments",
        error,
      ),
    );
  }

  return (data as CloudRecordAttachmentRow[]).map(
    mapCloudRecordAttachmentRow,
  );
};

export const listCloudAttachmentsForRepairRecord = async (
  repairRecordId: string,
): Promise<RecordAttachment[]> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const { data, error } = await client
    .from("record_attachments")
    .select(cloudRecordAttachmentSelect)
    .eq("repair_record_id", repairRecordId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError(
        "Unable to load cloud repair attachments",
        error,
      ),
    );
  }

  return (data as CloudRecordAttachmentRow[]).map(
    mapCloudRecordAttachmentRow,
  );
};

export const createCloudAttachmentForServiceRecord = async (
  input: RecordAttachmentInput,
  options?: CreateCloudAttachmentOptions,
): Promise<RecordAttachment> => {
  const userId = await getAuthenticatedUserId();
  const serviceRecordId = input.service_record_id;

  if (!serviceRecordId) {
    throw new Error("Service record is required.");
  }

  const parentRecord = await getCloudServiceRecordForAttachment(
    serviceRecordId,
    userId,
  );

  if (!parentRecord) {
    throw new Error("Cloud service record not found for this account.");
  }

  return createCloudAttachment({
    input,
    options,
    parentRecord,
    recordType: "service",
  });
};

export const createCloudAttachmentForRepairRecord = async (
  input: RecordAttachmentInput,
  options?: CreateCloudAttachmentOptions,
): Promise<RecordAttachment> => {
  const userId = await getAuthenticatedUserId();
  const repairRecordId = input.repair_record_id;

  if (!repairRecordId) {
    throw new Error("Repair record is required.");
  }

  const parentRecord = await getCloudRepairRecordForAttachment(
    repairRecordId,
    userId,
  );

  if (!parentRecord) {
    throw new Error("Cloud repair record not found for this account.");
  }

  return createCloudAttachment({
    input,
    options,
    parentRecord,
    recordType: "repair",
  });
};

export const getCloudAttachmentSignedUrl = async (id: string) => {
  const client = requireSupabase();
  const attachment = await getCloudAttachment(id);

  if (!attachment?.storage_path) {
    throw new Error("Cloud attachment file was not found.");
  }

  const { data, error } = await client.storage
    .from(attachment.storage_bucket ?? recordAttachmentStorageBucket)
    .createSignedUrl(attachment.storage_path, 60 * 10);

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError(
        "Unable to create a private attachment link",
        error,
      ),
    );
  }

  return data.signedUrl;
};

export const deleteCloudAttachment = async (id: string): Promise<void> => {
  const client = requireSupabase();
  const userId = await getAuthenticatedUserId();
  const existing = await getCloudAttachment(id);

  if (!existing) {
    return;
  }

  if (existing.storage_path) {
    await removeStorageObject(
      existing.storage_path,
      existing.storage_bucket ?? recordAttachmentStorageBucket,
    );
  }

  const { error } = await client
    .from("record_attachments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError(
        "The file was removed, but attachment metadata could not be deleted",
        error,
      ),
    );
  }
};

export const deleteCloudAttachmentsForServiceRecord = async (
  serviceRecordId: string,
) => {
  const attachments =
    await listCloudAttachmentsForServiceRecord(serviceRecordId);

  await Promise.all(
    attachments.map((attachment) => deleteCloudAttachment(attachment.id)),
  );
};

export const deleteCloudAttachmentsForRepairRecord = async (
  repairRecordId: string,
) => {
  const attachments = await listCloudAttachmentsForRepairRecord(repairRecordId);

  await Promise.all(
    attachments.map((attachment) => deleteCloudAttachment(attachment.id)),
  );
};
