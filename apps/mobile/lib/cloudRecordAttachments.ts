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

type CloudAttachmentParentRecord = {
  id: string;
  user_id: string;
  vehicle_id: string;
};

type CloudRecordAttachmentPayload = {
  file_name: string;
  file_size_bytes: number | null;
  file_type: RecordAttachment["file_type"];
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

const uploadLocalFileToStorage = async ({
  contentType,
  fileType,
  localUri,
  path,
}: {
  contentType: string;
  fileType: RecordAttachment["file_type"];
  localUri: string;
  path: string;
}) => {
  const client = requireSupabase();
  let body: ArrayBuffer;

  try {
    const base64File = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
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

  if (body.byteLength > recordAttachmentFileSizeLimits[fileType]) {
    throw new Error(
      `${fileType === "photo" ? "Photo" : "PDF"} attachments must be ${recordAttachmentFileSizeLimitLabels[fileType]} or smaller.`,
    );
  }

  const { error } = await client.storage
    .from(recordAttachmentStorageBucket)
    .upload(path, body, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(
      formatCloudRecordAttachmentError("Unable to upload attachment", error),
    );
  }

  return body.byteLength;
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

const createCloudAttachment = async ({
  input,
  parentRecord,
  recordType,
}: {
  input: RecordAttachmentInput;
  parentRecord: CloudAttachmentParentRecord;
  recordType: RecordAttachmentRecordType;
}): Promise<RecordAttachment> => {
  const client = requireSupabase();
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

  const localId = createCloudLocalId();
  const storagePath = getRecordAttachmentStoragePath({
    attachmentId: localId,
    fileName: validatedInput.file_name,
    recordId: parentRecord.id,
    recordType,
    userId: parentRecord.user_id,
    vehicleId: parentRecord.vehicle_id,
  });
  const uploadedSize = await uploadLocalFileToStorage({
    contentType: validatedInput.mime_type,
    fileType: validatedInput.file_type,
    localUri: validatedInput.local_uri,
    path: storagePath,
  });
  const payload: CloudRecordAttachmentPayload = {
    file_name: validatedInput.file_name,
    file_size_bytes: validatedInput.file_size_bytes ?? uploadedSize ?? null,
    file_type: validatedInput.file_type,
    local_id: localId,
    local_uri: null,
    mime_type: validatedInput.mime_type,
    ocr_status: "not_started",
    repair_record_id: recordType === "repair" ? parentRecord.id : null,
    service_record_id: recordType === "service" ? parentRecord.id : null,
    storage_bucket: recordAttachmentStorageBucket,
    storage_path: storagePath,
    sync_status: "synced",
    user_id: parentRecord.user_id,
    vehicle_id: parentRecord.vehicle_id,
  };

  const { data, error } = await client
    .from("record_attachments")
    .insert(payload)
    .select(cloudRecordAttachmentSelect)
    .single();

  if (error) {
    try {
      await removeStorageObject(storagePath);
    } catch (cleanupError: unknown) {
      console.warn(
        "Unable to clean up uploaded attachment after metadata failure.",
        cleanupError,
      );
    }

    throw new Error(
      formatCloudRecordAttachmentError(
        "Attachment uploaded, but metadata could not be saved",
        error,
      ),
    );
  }

  return mapCloudRecordAttachmentRow(data as CloudRecordAttachmentRow);
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
    parentRecord,
    recordType: "service",
  });
};

export const createCloudAttachmentForRepairRecord = async (
  input: RecordAttachmentInput,
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
