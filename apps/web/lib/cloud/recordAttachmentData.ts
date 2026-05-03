import {
  recordAttachmentStorageBucket,
  type RecordAttachment,
} from "@autoledger/shared";

import { createClient } from "../supabase/server";
import {
  mapCloudRecordAttachmentRow,
  recordAttachmentSelect,
  type CloudRecordAttachmentRow,
} from "./mappers";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

type AttachmentParentType = "repair" | "service";

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

const getAttachmentParent = async ({
  parentType,
  recordId,
  userId,
  vehicleId,
}: AttachmentParentInput) => {
  const supabase = await createClient();
  const table =
    parentType === "service" ? "service_records" : "repair_records";
  const { data, error } = await supabase
    .from(table)
    .select("id")
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
