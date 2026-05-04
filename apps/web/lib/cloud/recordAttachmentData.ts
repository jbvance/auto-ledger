import {
  getRecordAttachmentStoragePath,
  recordAttachmentFileSizeLimitLabels,
  recordAttachmentFileSizeLimits,
  recordAttachmentStorageBucket,
  type RecordAttachment,
  type RecordAttachmentFileType,
  type RecordAttachmentInput,
  type RecordAttachmentRecordType,
} from "@autoledger/shared";
import { recordAttachmentSchema } from "@autoledger/validation";

import { createClient } from "../supabase/server";
import {
  mapCloudRecordAttachmentRow,
  recordAttachmentSelect,
  type CloudRecordAttachmentRow,
} from "./mappers";

type SupabaseErrorLike = {
  code?: string;
  message: string;
  statusCode?: number | string;
};

type AttachmentParentType = "repair" | "service";

type AttachmentParent = {
  id: string;
  user_id: string;
  vehicle_id: string;
};

type AttachmentParentInput = {
  parentType: AttachmentParentType;
  recordId: string;
  userId: string;
  vehicleId: string;
};

type AttachmentLookupInput = {
  attachmentId: string;
  repairRecordId?: string;
  serviceRecordId?: string;
  userId: string;
  vehicleId: string;
};

type WebCloudRecordAttachmentPayload = {
  file_name: string;
  file_size_bytes: number;
  file_type: RecordAttachmentFileType;
  local_id: string;
  local_uri: null;
  mime_type: string;
  ocr_status: RecordAttachment["ocr_status"];
  repair_record_id: string | null;
  service_record_id: string | null;
  storage_bucket: string;
  storage_path: string;
  sync_status: RecordAttachment["sync_status"];
  user_id: string;
  vehicle_id: string;
};

type ValidatedWebAttachmentFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  fileName: string;
  fileSizeBytes: number;
  fileType: RecordAttachmentFileType;
  mimeType: string;
};

export type WebCloudAttachmentDeleteStatus =
  | "deleted"
  | "not_found"
  | "storage_already_missing";

export const webCloudAttachmentAllowedMimeTypes = [
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const allowedWebCloudAttachmentMimeTypes = new Set<string>(
  webCloudAttachmentAllowedMimeTypes,
);

const formatCloudRecordAttachmentError = (
  action: string,
  error: SupabaseErrorLike,
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

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudRecordAttachmentError(action, error));
  }
};

const isStorageObjectMissingError = (error: SupabaseErrorLike) => {
  const statusCode = String(error.statusCode ?? "");
  const message = error.message.toLowerCase();

  return (
    statusCode === "404" ||
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("no such object")
  );
};

const removeWebCloudAttachmentStorageObject = async ({
  storageBucket,
  storagePath,
}: {
  storageBucket: string;
  storagePath: string;
}): Promise<"already_missing" | "removed"> => {
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(storageBucket)
    .remove([storagePath]);

  if (error) {
    if (isStorageObjectMissingError(error)) {
      return "already_missing";
    }

    throw new Error(
      formatCloudRecordAttachmentError(
        "Unable to delete the attachment file",
        error,
      ),
    );
  }

  return "removed";
};

const getAttachmentParent = async ({
  parentType,
  recordId,
  userId,
  vehicleId,
}: AttachmentParentInput): Promise<AttachmentParent | null> => {
  const supabase = await createClient();
  const table =
    parentType === "service" ? "service_records" : "repair_records";
  const { data, error } = await supabase
    .from(table)
    .select("id, user_id, vehicle_id")
    .eq("id", recordId)
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .maybeSingle();

  throwIfError(
    parentType === "service"
      ? "Unable to verify cloud service record"
      : "Unable to verify cloud repair record",
    error,
  );

  return data;
};

const getAttachmentFileTypeFromMimeType = (
  mimeType: string,
): RecordAttachmentFileType | null => {
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (mimeType.startsWith("image/")) {
    return "photo";
  }

  return null;
};

const getFallbackFileName = (fileType: RecordAttachmentFileType) =>
  fileType === "pdf" ? "attachment.pdf" : "attachment.jpg";

const normalizeUploadedFileName = ({
  fileName,
  fileType,
}: {
  fileName: string;
  fileType: RecordAttachmentFileType;
}) => {
  const trimmed = fileName.trim();

  return trimmed || getFallbackFileName(fileType);
};

const createWebCloudAttachmentLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `web_att_${crypto.randomUUID()}`;
  }

  return `web_att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const toSupabaseFileBody = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);

  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

export const validateWebCloudAttachmentFile = (file: File | null | undefined) => {
  if (!file || file.size === 0) {
    throw new Error("Choose a photo or PDF to upload.");
  }

  const mimeType = file.type.trim().toLowerCase();
  const fileType = getAttachmentFileTypeFromMimeType(mimeType);

  if (!fileType || !allowedWebCloudAttachmentMimeTypes.has(mimeType)) {
    throw new Error("Attach a JPEG, PNG, WebP, GIF, or PDF file.");
  }

  if (file.size > recordAttachmentFileSizeLimits[fileType]) {
    throw new Error(
      `${fileType === "photo" ? "Photo" : "PDF"} attachments must be ${recordAttachmentFileSizeLimitLabels[fileType]} or smaller.`,
    );
  }

  const fileName = normalizeUploadedFileName({
    fileName: file.name,
    fileType,
  });

  return {
    arrayBuffer: () => file.arrayBuffer(),
    fileName,
    fileSizeBytes: file.size,
    fileType,
    mimeType,
  };
};

export const buildWebCloudRecordAttachmentPayload = ({
  attachmentFile,
  localId,
  parentRecord,
  recordType,
}: {
  attachmentFile: Pick<
    ValidatedWebAttachmentFile,
    "fileName" | "fileSizeBytes" | "fileType" | "mimeType"
  >;
  localId: string;
  parentRecord: AttachmentParent;
  recordType: RecordAttachmentRecordType;
}): WebCloudRecordAttachmentPayload => {
  const input: RecordAttachmentInput = {
    file_name: attachmentFile.fileName,
    file_size_bytes: attachmentFile.fileSizeBytes,
    file_type: attachmentFile.fileType,
    local_uri: `web-upload://${localId}`,
    mime_type: attachmentFile.mimeType,
    repair_record_id: recordType === "repair" ? parentRecord.id : undefined,
    service_record_id: recordType === "service" ? parentRecord.id : undefined,
    vehicle_id: parentRecord.vehicle_id,
  };
  const validation = recordAttachmentSchema.safeParse(input);

  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ??
        "Attachment details could not be validated.",
    );
  }

  const storagePath = getRecordAttachmentStoragePath({
    attachmentId: localId,
    fileName: validation.data.file_name,
    recordId: parentRecord.id,
    recordType,
    userId: parentRecord.user_id,
    vehicleId: parentRecord.vehicle_id,
  });

  return {
    file_name: validation.data.file_name,
    file_size_bytes: validation.data.file_size_bytes ?? attachmentFile.fileSizeBytes,
    file_type: validation.data.file_type,
    local_id: localId,
    local_uri: null,
    mime_type: validation.data.mime_type,
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

export const insertWebCloudAttachmentMetadataWithUploadCleanup = async ({
  payload,
}: {
  payload: WebCloudRecordAttachmentPayload;
}) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("record_attachments")
    .insert(payload)
    .select(recordAttachmentSelect)
    .single();

  if (!error) {
    return mapCloudRecordAttachmentRow(data as CloudRecordAttachmentRow);
  }

  const errorMessage = formatCloudRecordAttachmentError(
    "Attachment uploaded, but metadata could not be saved",
    error,
  );

  try {
    await removeWebCloudAttachmentStorageObject({
      storageBucket: payload.storage_bucket,
      storagePath: payload.storage_path,
    });
  } catch (cleanupError: unknown) {
    console.warn(
      "Unable to clean up uploaded web attachment after metadata failure.",
      cleanupError,
    );

    throw new Error(
      `${errorMessage} Cleanup was attempted, but the uploaded file could not be removed automatically. Please try again or contact support.`,
    );
  }

  throw new Error(errorMessage);
};

const uploadWebAttachmentForParent = async ({
  attachmentFile,
  parentRecord,
  recordType,
}: {
  attachmentFile: ValidatedWebAttachmentFile;
  parentRecord: AttachmentParent;
  recordType: RecordAttachmentRecordType;
}) => {
  const localId = createWebCloudAttachmentLocalId();
  const payload = buildWebCloudRecordAttachmentPayload({
    attachmentFile,
    localId,
    parentRecord,
    recordType,
  });
  const body = toSupabaseFileBody(await attachmentFile.arrayBuffer());
  const supabase = await createClient();
  const uploadResult = await supabase.storage
    .from(recordAttachmentStorageBucket)
    .upload(payload.storage_path, body, {
      contentType: payload.mime_type,
      upsert: false,
    });

  throwIfError("Unable to upload attachment", uploadResult.error);

  return insertWebCloudAttachmentMetadataWithUploadCleanup({ payload });
};

export const uploadWebCloudAttachmentForServiceRecord = async ({
  file,
  serviceRecordId,
  userId,
  vehicleId,
}: {
  file: File;
  serviceRecordId: string;
  userId: string;
  vehicleId: string;
}) => {
  const parentRecord = await getAttachmentParent({
    parentType: "service",
    recordId: serviceRecordId,
    userId,
    vehicleId,
  });

  if (!parentRecord) {
    return null;
  }

  return uploadWebAttachmentForParent({
    attachmentFile: validateWebCloudAttachmentFile(file),
    parentRecord,
    recordType: "service",
  });
};

export const uploadWebCloudAttachmentForRepairRecord = async ({
  file,
  repairRecordId,
  userId,
  vehicleId,
}: {
  file: File;
  repairRecordId: string;
  userId: string;
  vehicleId: string;
}) => {
  const parentRecord = await getAttachmentParent({
    parentType: "repair",
    recordId: repairRecordId,
    userId,
    vehicleId,
  });

  if (!parentRecord) {
    return null;
  }

  return uploadWebAttachmentForParent({
    attachmentFile: validateWebCloudAttachmentFile(file),
    parentRecord,
    recordType: "repair",
  });
};

const listWebCloudAttachmentsForParent = async ({
  parentType,
  recordId,
  userId,
  vehicleId,
}: AttachmentParentInput): Promise<RecordAttachment[]> => {
  const parent = await getAttachmentParent({
    parentType,
    recordId,
    userId,
    vehicleId,
  });

  if (!parent) {
    return [];
  }

  const supabase = await createClient();
  const parentColumn =
    parentType === "service" ? "service_record_id" : "repair_record_id";
  const { data, error } = await supabase
    .from("record_attachments")
    .select(recordAttachmentSelect)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .eq(parentColumn, recordId)
    .order("created_at", { ascending: false });

  throwIfError(
    parentType === "service"
      ? "Unable to load cloud service attachments"
      : "Unable to load cloud repair attachments",
    error,
  );

  return ((data ?? []) as CloudRecordAttachmentRow[]).map(
    mapCloudRecordAttachmentRow,
  );
};

export const listWebCloudAttachmentsForServiceRecord = async ({
  serviceRecordId,
  userId,
  vehicleId,
}: {
  serviceRecordId: string;
  userId: string;
  vehicleId: string;
}) =>
  listWebCloudAttachmentsForParent({
    parentType: "service",
    recordId: serviceRecordId,
    userId,
    vehicleId,
  });

export const listWebCloudAttachmentsForRepairRecord = async ({
  repairRecordId,
  userId,
  vehicleId,
}: {
  repairRecordId: string;
  userId: string;
  vehicleId: string;
}) =>
  listWebCloudAttachmentsForParent({
    parentType: "repair",
    recordId: repairRecordId,
    userId,
    vehicleId,
  });

const getWebCloudAttachmentForSignedUrl = async ({
  attachmentId,
  repairRecordId,
  serviceRecordId,
  userId,
  vehicleId,
}: AttachmentLookupInput): Promise<RecordAttachment | null> => {
  const hasServiceRecord = Boolean(serviceRecordId);
  const hasRepairRecord = Boolean(repairRecordId);

  if (hasServiceRecord === hasRepairRecord) {
    throw new Error("Attachment must be requested for one service or repair record.");
  }

  const parent = await getAttachmentParent({
    parentType: hasServiceRecord ? "service" : "repair",
    recordId: serviceRecordId ?? repairRecordId ?? "",
    userId,
    vehicleId,
  });

  if (!parent) {
    return null;
  }

  const supabase = await createClient();
  let query = supabase
    .from("record_attachments")
    .select(recordAttachmentSelect)
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId);

  query = hasServiceRecord
    ? query.eq("service_record_id", serviceRecordId ?? "")
    : query.eq("repair_record_id", repairRecordId ?? "");

  const { data, error } = await query.maybeSingle();

  throwIfError("Unable to load cloud attachment", error);

  return data
    ? mapCloudRecordAttachmentRow(data as CloudRecordAttachmentRow)
    : null;
};

export const deleteWebCloudAttachment = async (
  input: AttachmentLookupInput,
): Promise<WebCloudAttachmentDeleteStatus> => {
  const attachment = await getWebCloudAttachmentForSignedUrl(input);

  if (!attachment) {
    return "not_found";
  }

  const supabase = await createClient();
  let storageStatus: "already_missing" | "removed" = "removed";

  if (attachment.storage_path) {
    storageStatus = await removeWebCloudAttachmentStorageObject({
      storageBucket: attachment.storage_bucket ?? recordAttachmentStorageBucket,
      storagePath: attachment.storage_path,
    });
  }

  let query = supabase
    .from("record_attachments")
    .delete()
    .eq("id", input.attachmentId)
    .eq("user_id", input.userId)
    .eq("vehicle_id", input.vehicleId);

  query = input.serviceRecordId
    ? query.eq("service_record_id", input.serviceRecordId)
    : query.eq("repair_record_id", input.repairRecordId ?? "");

  const { error } = await query;

  if (error) {
    console.warn("Web attachment file removed but metadata delete failed.", {
      attachmentId: input.attachmentId,
      operation: "delete_web_cloud_attachment",
    });

    throw new Error(
      formatCloudRecordAttachmentError(
        "The attachment file was removed, but its record could not be cleared. Please try again",
        error,
      ),
    );
  }

  return storageStatus === "already_missing"
    ? "storage_already_missing"
    : "deleted";
};

export const deleteWebCloudAttachmentsForServiceRecord = async ({
  serviceRecordId,
  userId,
  vehicleId,
}: {
  serviceRecordId: string;
  userId: string;
  vehicleId: string;
}) => {
  const attachments = await listWebCloudAttachmentsForServiceRecord({
    serviceRecordId,
    userId,
    vehicleId,
  });

  for (const attachment of attachments) {
    await deleteWebCloudAttachment({
      attachmentId: attachment.id,
      serviceRecordId,
      userId,
      vehicleId,
    });
  }
};

export const deleteWebCloudAttachmentsForRepairRecord = async ({
  repairRecordId,
  userId,
  vehicleId,
}: {
  repairRecordId: string;
  userId: string;
  vehicleId: string;
}) => {
  const attachments = await listWebCloudAttachmentsForRepairRecord({
    repairRecordId,
    userId,
    vehicleId,
  });

  for (const attachment of attachments) {
    await deleteWebCloudAttachment({
      attachmentId: attachment.id,
      repairRecordId,
      userId,
      vehicleId,
    });
  }
};

export const createSignedUrlForCloudAttachment = async (
  input: AttachmentLookupInput,
) => {
  const attachment = await getWebCloudAttachmentForSignedUrl(input);

  if (!attachment) {
    return null;
  }

  if (!attachment.storage_path) {
    throw new Error("Cloud attachment file was not found.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket ?? recordAttachmentStorageBucket)
    .createSignedUrl(attachment.storage_path, 60 * 10);

  throwIfError("Unable to create a private attachment link", error);

  if (!data?.signedUrl) {
    throw new Error("Unable to create a private attachment link.");
  }

  return data.signedUrl;
};
