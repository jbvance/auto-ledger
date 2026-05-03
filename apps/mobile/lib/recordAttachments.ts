import {
  recordAttachmentFileSizeLimitLabels,
  recordAttachmentFileSizeLimits,
  type RecordAttachment,
  type RecordAttachmentFileType,
  type RecordAttachmentInput,
} from "@autoledger/shared";
import { recordAttachmentSchema } from "@autoledger/validation";
import * as FileSystem from "expo-file-system/legacy";

import { bindOptional, createLocalId, getGuestDatabase } from "./database";

type RecordAttachmentRow = Omit<
  RecordAttachment,
  "file_type" | "ocr_status"
> & {
  file_type: string;
  ocr_status: string;
};

const attachmentsDirectory = `${FileSystem.documentDirectory ?? ""}attachments/`;

const optionalText = (value: string | null | undefined) => value ?? null;

const optionalNumber = (value: number | null | undefined) => value ?? null;

const mapAttachmentRow = (row: RecordAttachmentRow): RecordAttachment => ({
  ...row,
  file_type: row.file_type as RecordAttachment["file_type"],
  ocr_status: row.ocr_status as RecordAttachment["ocr_status"],
  sync_status: row.sync_status as RecordAttachment["sync_status"],
});

const extensionForMimeType = (mimeType: string, fileType: string) => {
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  const extension = mimeType.startsWith("image/")
    ? mimeType.split("/")[1]
    : fileType === "photo"
      ? "jpg"
      : "pdf";

  return extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "file";
};

const sanitizeFileName = (
  fileName: string,
  mimeType: string,
  fileType: string,
) => {
  const fallback = `attachment.${extensionForMimeType(mimeType, fileType)}`;
  const cleaned = fileName.trim().replace(/[^\w.-]+/g, "_");

  return cleaned || fallback;
};

type StoredAttachmentFile = {
  fileSizeBytes?: number;
  localUri: string;
};

const getFileSizeLimitMessage = (
  fileType: RecordAttachmentFileType,
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

const getStoredFileUri = async ({
  id,
  input,
}: {
  id: string;
  input: RecordAttachmentInput;
}): Promise<StoredAttachmentFile> => {
  if (!FileSystem.documentDirectory) {
    if (input.file_type === "pdf") {
      throw new Error("Local document storage is unavailable for PDFs.");
    }

    return {
      fileSizeBytes: input.file_size_bytes ?? undefined,
      localUri: input.local_uri,
    };
  }

  const fileName = sanitizeFileName(
    input.file_name,
    input.mime_type,
    input.file_type,
  );
  const destination = `${attachmentsDirectory}${id}-${fileName}`;

  try {
    await FileSystem.makeDirectoryAsync(attachmentsDirectory, {
      intermediates: true,
    });
    await FileSystem.copyAsync({
      from: input.local_uri,
      to: destination,
    });
    const fileInfo = await FileSystem.getInfoAsync(destination);

    if (!fileInfo.exists || fileInfo.size <= 0) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      throw new Error("Attachment copy could not be verified.");
    }

    const fileSizeLimitMessage = getFileSizeLimitMessage(
      input.file_type,
      fileInfo.size,
    );

    if (fileSizeLimitMessage) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      throw new Error(fileSizeLimitMessage);
    }

    return {
      fileSizeBytes: fileInfo.size,
      localUri: destination,
    };
  } catch (error: unknown) {
    console.warn("Unable to copy attachment into app storage.", error);

    if (error instanceof Error && error.message.endsWith("or smaller.")) {
      throw error;
    }

    if (input.file_type === "pdf") {
      throw new Error("Unable to save this PDF locally.");
    }

    return {
      fileSizeBytes: input.file_size_bytes ?? undefined,
      localUri: input.local_uri,
    };
  }
};

const removeLocalFileIfOwned = async (localUri: string) => {
  if (
    !FileSystem.documentDirectory ||
    !localUri.startsWith(attachmentsDirectory)
  ) {
    return;
  }

  try {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  } catch (error: unknown) {
    console.warn("Unable to delete local attachment file.", error);
  }
};

const getRecordVehicleId = async ({
  repairRecordId,
  serviceRecordId,
}: {
  repairRecordId?: string | null;
  serviceRecordId?: string | null;
}) => {
  const db = await getGuestDatabase();

  if (serviceRecordId) {
    const row = await db.getFirstAsync<{ vehicle_id: string }>(
      `SELECT vehicle_id
       FROM service_records
       WHERE id = ?
       LIMIT 1`,
      serviceRecordId,
    );

    return row?.vehicle_id ?? null;
  }

  if (repairRecordId) {
    const row = await db.getFirstAsync<{ vehicle_id: string }>(
      `SELECT vehicle_id
       FROM repair_records
       WHERE id = ?
       LIMIT 1`,
      repairRecordId,
    );

    return row?.vehicle_id ?? null;
  }

  return null;
};

const assertAttachmentRecord = async (input: RecordAttachmentInput) => {
  const recordVehicleId = await getRecordVehicleId({
    repairRecordId: input.repair_record_id,
    serviceRecordId: input.service_record_id,
  });

  if (!recordVehicleId) {
    throw new Error("Record not found.");
  }

  if (recordVehicleId !== input.vehicle_id) {
    throw new Error("Attachment vehicle must match the record.");
  }
};

export const listAttachmentsForServiceRecord = async (
  serviceRecordId: string,
): Promise<RecordAttachment[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<RecordAttachmentRow>(
    `SELECT *
     FROM record_attachments
     WHERE service_record_id = ?
     ORDER BY created_at DESC`,
    serviceRecordId,
  );

  return rows.map(mapAttachmentRow);
};

export const listAttachmentsForRepairRecord = async (
  repairRecordId: string,
): Promise<RecordAttachment[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<RecordAttachmentRow>(
    `SELECT *
     FROM record_attachments
     WHERE repair_record_id = ?
     ORDER BY created_at DESC`,
    repairRecordId,
  );

  return rows.map(mapAttachmentRow);
};

export const listAllAttachments = async (): Promise<RecordAttachment[]> => {
  const db = await getGuestDatabase();
  const rows = await db.getAllAsync<RecordAttachmentRow>(
    `SELECT *
     FROM record_attachments
     ORDER BY created_at DESC`,
  );

  return rows.map(mapAttachmentRow);
};

export const getAttachment = async (
  id: string,
): Promise<RecordAttachment | null> => {
  const db = await getGuestDatabase();
  const row = await db.getFirstAsync<RecordAttachmentRow>(
    `SELECT *
     FROM record_attachments
     WHERE id = ?
     LIMIT 1`,
    id,
  );

  return row ? mapAttachmentRow(row) : null;
};

export const createAttachment = async (
  input: RecordAttachmentInput,
): Promise<RecordAttachment> => {
  const validation = recordAttachmentSchema.safeParse(input);

  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ??
        "Attachment details could not be validated.",
    );
  }

  const validatedInput = validation.data;

  await assertAttachmentRecord(validatedInput);

  const db = await getGuestDatabase();
  const now = new Date().toISOString();
  const id = createLocalId("att");
  const storedFile = await getStoredFileUri({ id, input: validatedInput });
  const attachment: RecordAttachment = {
    id,
    local_id: id,
    vehicle_id: validatedInput.vehicle_id,
    service_record_id: optionalText(validatedInput.service_record_id),
    repair_record_id: optionalText(validatedInput.repair_record_id),
    file_name: validatedInput.file_name,
    file_type: validatedInput.file_type,
    mime_type: validatedInput.mime_type,
    file_size_bytes: optionalNumber(
      storedFile.fileSizeBytes ?? validatedInput.file_size_bytes,
    ),
    storage_bucket: null,
    storage_path: null,
    local_uri: storedFile.localUri,
    ocr_status: "not_started",
    ocr_text: null,
    ocr_vendor: null,
    ocr_processed_at: null,
    created_at: now,
    updated_at: now,
    sync_status: "local_only",
  };

  await db.runAsync(
    `INSERT INTO record_attachments (
      id,
      local_id,
      vehicle_id,
      service_record_id,
      repair_record_id,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attachment.id,
      attachment.local_id,
      attachment.vehicle_id,
      bindOptional(attachment.service_record_id),
      bindOptional(attachment.repair_record_id),
      attachment.file_name,
      attachment.file_type,
      attachment.mime_type,
      bindOptional(attachment.file_size_bytes),
      bindOptional(attachment.storage_bucket),
      bindOptional(attachment.storage_path),
      attachment.local_uri ?? "",
      attachment.ocr_status,
      bindOptional(attachment.ocr_text),
      bindOptional(attachment.ocr_vendor),
      bindOptional(attachment.ocr_processed_at),
      attachment.created_at,
      attachment.updated_at,
      attachment.sync_status,
    ],
  );

  return attachment;
};

export const deleteAttachment = async (id: string): Promise<void> => {
  const existing = await getAttachment(id);

  if (!existing) {
    return;
  }

  const db = await getGuestDatabase();

  await db.runAsync(`DELETE FROM record_attachments WHERE id = ?`, id);
  if (existing.local_uri) {
    await removeLocalFileIfOwned(existing.local_uri);
  }
};

export const deleteAttachmentsForServiceRecord = async (
  serviceRecordId: string,
): Promise<void> => {
  const attachments = await listAttachmentsForServiceRecord(serviceRecordId);
  await Promise.all(
    attachments.map((attachment) => deleteAttachment(attachment.id)),
  );
};

export const deleteAttachmentsForRepairRecord = async (
  repairRecordId: string,
): Promise<void> => {
  const attachments = await listAttachmentsForRepairRecord(repairRecordId);
  await Promise.all(
    attachments.map((attachment) => deleteAttachment(attachment.id)),
  );
};
