import type {
  RecordAttachment,
  RecordAttachmentInput,
  RepairRecord,
  ServiceRecord,
} from "@autoledger/shared";

import {
  buildCloudRecordAttachmentPayload,
  getCloudAttachmentByLocalIdForUser,
  getCloudRecordAttachmentDuplicateState,
  getCloudRecordAttachmentMetadataWriteErrorMessage,
  insertCloudAttachmentMetadataWithUploadCleanup,
  uploadLocalFileToStorage,
  type CloudRecordAttachmentPayload,
  type CloudRecordAttachmentMetadataWriteResult,
} from "./cloudRecordAttachments";
import {
  createRecordAttachmentMigrationRun,
  getAttachmentMigrationMappings,
  getRepairRecordMigrationMappings,
  getServiceRecordMigrationMappings,
  getVehicleMigrationMappings,
  updateRecordAttachmentMigrationRunStatus,
  upsertAttachmentMigrationMapping,
  type MigrationEntityMapping,
  type MigrationRun,
  type MigrationRunRecordAttachmentCounts,
} from "./guestMigration";
import { listAllAttachments } from "./recordAttachments";
import { getRepairRecord } from "./repairRecords";
import { getServiceRecord } from "./serviceRecords";
import { supabase } from "./supabase";
import { getVehicle } from "./vehicles";

export type GuestAttachmentParentRecordType = "repair" | "service";

export type GuestAttachmentParentMappingResolutionStatus =
  | "invalid_parent"
  | "missing_parent_mapping"
  | "missing_parent_record"
  | "missing_vehicle_mapping"
  | "ready"
  | "vehicle_mismatch";

export type GuestAttachmentParentMappingResolution = {
  attachmentLocalId: string;
  cloudParentRecordId: string | null;
  cloudVehicleId: string | null;
  errorMessage: string | null;
  localRetention: GuestAttachmentLocalRetention;
  localParentId: string | null;
  localParentLocalId: string | null;
  localVehicleId: string | null;
  localVehicleLocalId: string | null;
  recordType: GuestAttachmentParentRecordType | null;
  status: GuestAttachmentParentMappingResolutionStatus;
};

export type GuestAttachmentLocalRetention = {
  localAttachmentId: string;
  localAttachmentLocalId: string;
  localFileUri: string | null;
  shouldDeleteLocalFile: false;
  shouldDeleteLocalRecord: false;
};

type ResolveGuestAttachmentParentMappingsInput = {
  accountId: string;
  attachment: RecordAttachment;
  repairRecordMappings?: MigrationEntityMapping[];
  serviceRecordMappings?: MigrationEntityMapping[];
  vehicleMappings?: MigrationEntityMapping[];
};

export type GuestAttachmentMigrationItemStatus =
  | "already_migrated"
  | "failed_metadata"
  | "failed_upload"
  | "migrated"
  | "skipped_missing_parent_mapping"
  | "skipped_unsupported";

export type GuestAttachmentMigrationItemResult = {
  cloudId: string | null;
  cloudParentRecordId: string | null;
  cloudVehicleId: string | null;
  errorMessage: string | null;
  localId: string;
  localFileUri: string | null;
  recordType: GuestAttachmentParentRecordType | null;
  status: GuestAttachmentMigrationItemStatus;
  storageBucket: string | null;
  storagePath: string | null;
};

export type GuestAttachmentMigrationResult = {
  failedCleanupCount: number;
  failedCount: number;
  failedMetadataCount: number;
  failedUploadCount: number;
  migratedCount: number;
  results: GuestAttachmentMigrationItemResult[];
  run: MigrationRun;
  skippedAlreadyMigratedCount: number;
  skippedMissingParentMappingCount: number;
  skippedUnsupportedCount: number;
  totalAttachments: number;
};

type MigratedAttachmentPayload = CloudRecordAttachmentPayload & {
  created_at: string;
  ocr_processed_at: string | null;
  ocr_text: string | null;
  ocr_vendor: string | null;
  updated_at: string;
};

type CloudAttachmentMigrationError = {
  code?: string;
  message: string;
};

const mappingIsReady = (
  mapping: MigrationEntityMapping | undefined,
): mapping is MigrationEntityMapping & { cloud_id: string } =>
  mapping?.status === "synced" &&
  typeof mapping.cloud_id === "string" &&
  mapping.cloud_id.length > 0;

const getReadyCloudId = (mapping: MigrationEntityMapping | undefined) =>
  mappingIsReady(mapping) ? mapping.cloud_id : null;

const getRecordType = (
  attachment: Pick<RecordAttachment, "repair_record_id" | "service_record_id">,
): GuestAttachmentParentRecordType | null => {
  const hasServiceRecord = Boolean(attachment.service_record_id);
  const hasRepairRecord = Boolean(attachment.repair_record_id);

  if (hasServiceRecord === hasRepairRecord) {
    return null;
  }

  return hasServiceRecord ? "service" : "repair";
};

const resolveLocalParentRecord = async (
  attachment: RecordAttachment,
  recordType: GuestAttachmentParentRecordType,
): Promise<RepairRecord | ServiceRecord | null> => {
  if (recordType === "service") {
    return attachment.service_record_id
      ? getServiceRecord(attachment.service_record_id)
      : null;
  }

  return attachment.repair_record_id
    ? getRepairRecord(attachment.repair_record_id)
    : null;
};

const buildLocalRetention = (
  attachment: RecordAttachment,
): GuestAttachmentLocalRetention => ({
  localAttachmentId: attachment.id,
  localAttachmentLocalId: attachment.local_id,
  localFileUri: attachment.local_uri ?? null,
  shouldDeleteLocalFile: false,
  shouldDeleteLocalRecord: false,
});

export const resolveGuestAttachmentParentMappings = async ({
  accountId,
  attachment,
  repairRecordMappings,
  serviceRecordMappings,
  vehicleMappings,
}: ResolveGuestAttachmentParentMappingsInput): Promise<GuestAttachmentParentMappingResolution> => {
  const recordType = getRecordType(attachment);
  const localRetention = buildLocalRetention(attachment);

  if (!recordType) {
    return {
      attachmentLocalId: attachment.local_id,
      cloudParentRecordId: null,
      cloudVehicleId: null,
      errorMessage:
        "Attachment must belong to exactly one local service or repair record.",
      localRetention,
      localParentId: null,
      localParentLocalId: null,
      localVehicleId: attachment.vehicle_id,
      localVehicleLocalId: null,
      recordType: null,
      status: "invalid_parent",
    };
  }

  const localParentRecord = await resolveLocalParentRecord(
    attachment,
    recordType,
  );

  if (!localParentRecord) {
    return {
      attachmentLocalId: attachment.local_id,
      cloudParentRecordId: null,
      cloudVehicleId: null,
      errorMessage:
        "Attachment was skipped because its local service or repair record was not found.",
      localRetention,
      localParentId:
        recordType === "service"
          ? (attachment.service_record_id ?? null)
          : (attachment.repair_record_id ?? null),
      localParentLocalId: null,
      localVehicleId: attachment.vehicle_id,
      localVehicleLocalId: null,
      recordType,
      status: "missing_parent_record",
    };
  }

  if (localParentRecord.vehicle_id !== attachment.vehicle_id) {
    return {
      attachmentLocalId: attachment.local_id,
      cloudParentRecordId: null,
      cloudVehicleId: null,
      errorMessage:
        "Attachment vehicle does not match its local service or repair record.",
      localRetention,
      localParentId: localParentRecord.id,
      localParentLocalId: localParentRecord.local_id,
      localVehicleId: attachment.vehicle_id,
      localVehicleLocalId: null,
      recordType,
      status: "vehicle_mismatch",
    };
  }

  const [nextVehicleMappings, nextServiceRecordMappings, nextRepairRecordMappings] =
    await Promise.all([
      vehicleMappings ?? getVehicleMigrationMappings(accountId),
      serviceRecordMappings ?? getServiceRecordMigrationMappings(accountId),
      repairRecordMappings ?? getRepairRecordMigrationMappings(accountId),
    ]);
  const localVehicle = await getVehicle(localParentRecord.vehicle_id, {
    includeArchived: true,
  });
  const localVehicleLocalId = localVehicle?.local_id ?? localParentRecord.vehicle_id;
  const vehicleMapping = new Map(
    nextVehicleMappings.map((mapping) => [mapping.local_id, mapping]),
  ).get(localVehicleLocalId);
  const parentMappingsByLocalId = new Map(
    (recordType === "service"
      ? nextServiceRecordMappings
      : nextRepairRecordMappings
    ).map((mapping) => [mapping.local_id, mapping]),
  );
  const parentMapping = parentMappingsByLocalId.get(localParentRecord.local_id);
  const cloudVehicleId = getReadyCloudId(vehicleMapping);
  const cloudParentRecordId = getReadyCloudId(parentMapping);

  if (!cloudVehicleId) {
    return {
      attachmentLocalId: attachment.local_id,
      cloudParentRecordId: null,
      cloudVehicleId: null,
      errorMessage:
        "Attachment was skipped because its vehicle has not been migrated to this account yet.",
      localRetention,
      localParentId: localParentRecord.id,
      localParentLocalId: localParentRecord.local_id,
      localVehicleId: localParentRecord.vehicle_id,
      localVehicleLocalId,
      recordType,
      status: "missing_vehicle_mapping",
    };
  }

  if (!cloudParentRecordId) {
    return {
      attachmentLocalId: attachment.local_id,
      cloudParentRecordId: null,
      cloudVehicleId,
      errorMessage:
        "Attachment was skipped because its service or repair record has not been migrated to this account yet.",
      localRetention,
      localParentId: localParentRecord.id,
      localParentLocalId: localParentRecord.local_id,
      localVehicleId: localParentRecord.vehicle_id,
      localVehicleLocalId,
      recordType,
      status: "missing_parent_mapping",
    };
  }

  return {
    attachmentLocalId: attachment.local_id,
    cloudParentRecordId,
    cloudVehicleId,
    errorMessage: null,
    localRetention,
    localParentId: localParentRecord.id,
    localParentLocalId: localParentRecord.local_id,
    localVehicleId: localParentRecord.vehicle_id,
    localVehicleLocalId,
    recordType,
    status: "ready",
  };
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the public Supabase URL and anon key before migrating attachments.",
    );
  }

  return supabase;
};

const assertAuthenticatedUser = async (userId: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Sign in before migrating attachments.");
  }

  if (data.user.id !== userId) {
    throw new Error("Signed-in account does not match the migration account.");
  }
};

const isUniqueConflict = (error: CloudAttachmentMigrationError) =>
  error.code === "23505" ||
  error.message.toLowerCase().includes("duplicate key");

const getAttachmentInputForCloudParent = ({
  attachment,
  resolution,
}: {
  attachment: RecordAttachment;
  resolution: GuestAttachmentParentMappingResolution & {
    cloudParentRecordId: string;
    cloudVehicleId: string;
    recordType: GuestAttachmentParentRecordType;
  };
}): RecordAttachmentInput => ({
  file_name: attachment.file_name,
  file_size_bytes: attachment.file_size_bytes,
  file_type: attachment.file_type,
  local_uri: attachment.local_uri ?? "",
  mime_type: attachment.mime_type,
  repair_record_id:
    resolution.recordType === "repair"
      ? resolution.cloudParentRecordId
      : undefined,
  service_record_id:
    resolution.recordType === "service"
      ? resolution.cloudParentRecordId
      : undefined,
  vehicle_id: resolution.cloudVehicleId,
});

const buildMigratedAttachmentPayload = ({
  attachment,
  resolution,
  uploadedSize,
  userId,
}: {
  attachment: RecordAttachment;
  resolution: GuestAttachmentParentMappingResolution & {
    cloudParentRecordId: string;
    cloudVehicleId: string;
    recordType: GuestAttachmentParentRecordType;
  };
  uploadedSize: number | null;
  userId: string;
}): MigratedAttachmentPayload => ({
  ...buildCloudRecordAttachmentPayload({
    input: getAttachmentInputForCloudParent({ attachment, resolution }),
    localId: attachment.local_id,
    parentRecord: {
      id: resolution.cloudParentRecordId,
      user_id: userId,
      vehicle_id: resolution.cloudVehicleId,
    },
    recordType: resolution.recordType,
    uploadedSize,
  }),
  created_at: attachment.created_at,
  ocr_processed_at: attachment.ocr_processed_at ?? null,
  ocr_status: attachment.ocr_status,
  ocr_text: attachment.ocr_text ?? null,
  ocr_vendor: attachment.ocr_vendor ?? null,
  updated_at: attachment.updated_at,
});

const getMetadataFailureStatus = (
  result: CloudRecordAttachmentMetadataWriteResult,
): GuestAttachmentMigrationItemStatus =>
  result.status === "metadata_insert_failed_cleanup_failed"
    ? "failed_metadata"
    : "failed_metadata";

export const migrateGuestAttachmentToCloud = async (
  attachment: RecordAttachment,
  userId: string,
  parentMapping: GuestAttachmentParentMappingResolution,
  runId: string | null = null,
): Promise<GuestAttachmentMigrationItemResult> => {
  const baseResult: Omit<GuestAttachmentMigrationItemResult, "errorMessage" | "status"> = {
    cloudId: null,
    cloudParentRecordId: parentMapping.cloudParentRecordId,
    cloudVehicleId: parentMapping.cloudVehicleId,
    localFileUri: parentMapping.localRetention.localFileUri,
    localId: attachment.local_id,
    recordType: parentMapping.recordType,
    storageBucket: null,
    storagePath: null,
  };

  if (parentMapping.status !== "ready") {
    const unsupported =
      parentMapping.status === "invalid_parent" ||
      parentMapping.status === "vehicle_mismatch";
    const errorMessage =
      parentMapping.errorMessage ??
      (unsupported
        ? "Attachment relationship is not supported for v1 migration."
        : "Attachment parent record has not been migrated to this account yet.");

    await upsertAttachmentMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: attachment.local_id,
      runId,
      status: "skipped",
    });

    return {
      ...baseResult,
      errorMessage,
      status: unsupported
        ? "skipped_unsupported"
        : "skipped_missing_parent_mapping",
    };
  }

  const readyParentMapping = parentMapping as typeof parentMapping & {
    cloudParentRecordId: string;
    cloudVehicleId: string;
    recordType: GuestAttachmentParentRecordType;
  };
  const payloadWithoutUploadedSize = buildMigratedAttachmentPayload({
    attachment,
    resolution: readyParentMapping,
    uploadedSize: attachment.file_size_bytes ?? null,
    userId,
  });

  try {
    const existingCloudAttachment = await getCloudAttachmentByLocalIdForUser({
      localId: attachment.local_id,
      userId,
    });
    const duplicateState = getCloudRecordAttachmentDuplicateState({
      existing: existingCloudAttachment,
      expected: payloadWithoutUploadedSize,
    });

    if (duplicateState.status === "already_migrated" && existingCloudAttachment) {
      await upsertAttachmentMigrationMapping({
        accountId: userId,
        cloudId: existingCloudAttachment.id,
        localId: attachment.local_id,
        runId,
        status: "synced",
      });

      return {
        ...baseResult,
        cloudId: existingCloudAttachment.id,
        cloudParentRecordId:
          existingCloudAttachment.service_record_id ??
          existingCloudAttachment.repair_record_id ??
          null,
        cloudVehicleId: existingCloudAttachment.vehicle_id,
        errorMessage: null,
        status: "already_migrated",
        storageBucket: existingCloudAttachment.storage_bucket ?? null,
        storagePath: existingCloudAttachment.storage_path ?? null,
      };
    }

    if (duplicateState.status === "conflicting_duplicate") {
      throw new Error(
        duplicateState.reason ??
          "Existing cloud attachment metadata conflicts with this local attachment.",
      );
    }

    const uploadResult = await uploadLocalFileToStorage({
      allowExistingObject: true,
      contentType: attachment.mime_type,
      fileType: attachment.file_type,
      localUri: attachment.local_uri ?? "",
      path: payloadWithoutUploadedSize.storage_path,
    });
    const payload = buildMigratedAttachmentPayload({
      attachment,
      resolution: readyParentMapping,
      uploadedSize: uploadResult.sizeBytes,
      userId,
    });
    const metadataWriteResult =
      await insertCloudAttachmentMetadataWithUploadCleanup({
        payload,
        storagePath: payload.storage_path,
      });

    if (metadataWriteResult.status !== "saved") {
      const errorMessage =
        getCloudRecordAttachmentMetadataWriteErrorMessage(
          metadataWriteResult,
        ) ?? "Attachment uploaded, but metadata could not be saved.";

      await upsertAttachmentMigrationMapping({
        accountId: userId,
        cloudId: null,
        errorMessage,
        localId: attachment.local_id,
        runId,
        status: "failed",
      });

      return {
        ...baseResult,
        errorMessage,
        status: getMetadataFailureStatus(metadataWriteResult),
        storageBucket: metadataWriteResult.storageBucket,
        storagePath: metadataWriteResult.storagePath,
      };
    }

    await upsertAttachmentMigrationMapping({
      accountId: userId,
      cloudId: metadataWriteResult.attachment.id,
      localId: attachment.local_id,
      runId,
      status: "synced",
    });

    return {
      ...baseResult,
      cloudId: metadataWriteResult.attachment.id,
      errorMessage: null,
      status: "migrated",
      storageBucket: metadataWriteResult.storageBucket,
      storagePath: metadataWriteResult.storagePath,
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      isUniqueConflict({ message: error.message })
    ) {
      const existingCloudAttachment = await getCloudAttachmentByLocalIdForUser({
        localId: attachment.local_id,
        userId,
      });

      if (existingCloudAttachment) {
        await upsertAttachmentMigrationMapping({
          accountId: userId,
          cloudId: existingCloudAttachment.id,
          localId: attachment.local_id,
          runId,
          status: "synced",
        });

        return {
          ...baseResult,
          cloudId: existingCloudAttachment.id,
          errorMessage: null,
          status: "already_migrated",
          storageBucket: existingCloudAttachment.storage_bucket ?? null,
          storagePath: existingCloudAttachment.storage_path ?? null,
        };
      }
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unable to migrate attachment.";
    const status: GuestAttachmentMigrationItemStatus =
      errorMessage.toLowerCase().includes("metadata") ||
      errorMessage.toLowerCase().includes("conflicts")
        ? "failed_metadata"
        : "failed_upload";

    await upsertAttachmentMigrationMapping({
      accountId: userId,
      cloudId: null,
      errorMessage,
      localId: attachment.local_id,
      runId,
      status: "failed",
    });

    return {
      ...baseResult,
      errorMessage,
      status,
      storageBucket: payloadWithoutUploadedSize.storage_bucket,
      storagePath: payloadWithoutUploadedSize.storage_path,
    };
  }
};

const getAttachmentMigrationRunStatus = ({
  counts,
}: {
  counts: MigrationRunRecordAttachmentCounts;
}) => {
  const issueCount =
    counts.failedRecordAttachments +
    counts.skippedRecordAttachmentsMissingParentMapping +
    counts.skippedRecordAttachmentsUnsupported;

  if (issueCount === 0) {
    return "completed";
  }

  if (
    counts.migratedRecordAttachments === 0 &&
    counts.skippedRecordAttachments === 0 &&
    issueCount >= counts.totalRecordAttachments
  ) {
    return "failed";
  }

  return "completed_with_errors";
};

const getAttachmentMigrationErrorMessage = (
  counts: MigrationRunRecordAttachmentCounts,
) => {
  const errorParts = [
    counts.skippedRecordAttachmentsMissingParentMapping > 0
      ? `${counts.skippedRecordAttachmentsMissingParentMapping} attachment${counts.skippedRecordAttachmentsMissingParentMapping === 1 ? " was" : "s were"} skipped because parent record migration mapping was missing`
      : null,
    counts.skippedRecordAttachmentsUnsupported > 0
      ? `${counts.skippedRecordAttachmentsUnsupported} attachment${counts.skippedRecordAttachmentsUnsupported === 1 ? " has" : "s have"} an unsupported v1 relationship`
      : null,
    counts.failedRecordAttachmentUploads > 0
      ? `${counts.failedRecordAttachmentUploads} attachment file upload${counts.failedRecordAttachmentUploads === 1 ? "" : "s"} failed`
      : null,
    counts.failedRecordAttachmentMetadata > 0
      ? `${counts.failedRecordAttachmentMetadata} attachment metadata write${counts.failedRecordAttachmentMetadata === 1 ? "" : "s"} failed`
      : null,
    counts.failedRecordAttachmentCleanup > 0
      ? `${counts.failedRecordAttachmentCleanup} uploaded file cleanup${counts.failedRecordAttachmentCleanup === 1 ? "" : "s"} failed after metadata errors`
      : null,
  ].filter(Boolean);

  return errorParts.length > 0
    ? `${errorParts.join("; ")}. Local attachment data and files were not changed.`
    : null;
};

export const migrateGuestAttachmentsToCloud = async (
  userId: string,
): Promise<GuestAttachmentMigrationResult> => {
  await assertAuthenticatedUser(userId);

  const [
    attachments,
    vehicleMappings,
    serviceRecordMappings,
    repairRecordMappings,
  ] = await Promise.all([
    listAllAttachments(),
    getVehicleMigrationMappings(userId),
    getServiceRecordMigrationMappings(userId),
    getRepairRecordMigrationMappings(userId),
  ]);
  const run = await createRecordAttachmentMigrationRun({
    accountId: userId,
    totalRecordAttachments: attachments.length,
  });
  const counts: MigrationRunRecordAttachmentCounts = {
    failedRecordAttachmentCleanup: 0,
    failedRecordAttachmentMetadata: 0,
    failedRecordAttachmentUploads: 0,
    failedRecordAttachments: 0,
    migratedRecordAttachments: 0,
    skippedRecordAttachments: 0,
    skippedRecordAttachmentsMissingParentMapping: 0,
    skippedRecordAttachmentsUnsupported: 0,
    totalRecordAttachments: attachments.length,
  };
  const results: GuestAttachmentMigrationItemResult[] = [];

  for (const attachment of attachments) {
    const parentResolution = await resolveGuestAttachmentParentMappings({
      accountId: userId,
      attachment,
      repairRecordMappings,
      serviceRecordMappings,
      vehicleMappings,
    });
    const result = await migrateGuestAttachmentToCloud(
      attachment,
      userId,
      parentResolution,
      run.id,
    );

    results.push(result);

    if (result.status === "migrated") {
      counts.migratedRecordAttachments += 1;
    } else if (result.status === "already_migrated") {
      counts.skippedRecordAttachments += 1;
    } else if (result.status === "skipped_missing_parent_mapping") {
      counts.skippedRecordAttachmentsMissingParentMapping += 1;
    } else if (result.status === "skipped_unsupported") {
      counts.skippedRecordAttachmentsUnsupported += 1;
    } else if (result.status === "failed_metadata") {
      counts.failedRecordAttachments += 1;
      counts.failedRecordAttachmentMetadata += 1;

      if (
        result.errorMessage
          ?.toLowerCase()
          .includes("could not be cleaned up automatically")
      ) {
        counts.failedRecordAttachmentCleanup += 1;
      }
    } else {
      counts.failedRecordAttachments += 1;
      counts.failedRecordAttachmentUploads += 1;
    }

    await updateRecordAttachmentMigrationRunStatus({
      counts,
      runId: run.id,
      status: "running",
    });
  }

  const completedAt = new Date().toISOString();
  const finalStatus = getAttachmentMigrationRunStatus({ counts });
  const errorMessage = getAttachmentMigrationErrorMessage(counts);

  await updateRecordAttachmentMigrationRunStatus({
    completedAt,
    counts,
    errorMessage,
    runId: run.id,
    status: finalStatus,
  });

  return {
    failedCleanupCount: counts.failedRecordAttachmentCleanup,
    failedCount: counts.failedRecordAttachments,
    failedMetadataCount: counts.failedRecordAttachmentMetadata,
    failedUploadCount: counts.failedRecordAttachmentUploads,
    migratedCount: counts.migratedRecordAttachments,
    results,
    run: {
      ...run,
      completed_at: completedAt,
      error_message: errorMessage,
      failed_record_attachment_cleanup:
        counts.failedRecordAttachmentCleanup,
      failed_record_attachment_metadata:
        counts.failedRecordAttachmentMetadata,
      failed_record_attachment_uploads: counts.failedRecordAttachmentUploads,
      failed_record_attachments: counts.failedRecordAttachments,
      migrated_record_attachments: counts.migratedRecordAttachments,
      skipped_record_attachments: counts.skippedRecordAttachments,
      skipped_record_attachments_missing_parent_mapping:
        counts.skippedRecordAttachmentsMissingParentMapping,
      skipped_record_attachments_unsupported:
        counts.skippedRecordAttachmentsUnsupported,
      status: finalStatus,
      total_record_attachments: counts.totalRecordAttachments,
      updated_at: completedAt,
    },
    skippedAlreadyMigratedCount: counts.skippedRecordAttachments,
    skippedMissingParentMappingCount:
      counts.skippedRecordAttachmentsMissingParentMapping,
    skippedUnsupportedCount: counts.skippedRecordAttachmentsUnsupported,
    totalAttachments: counts.totalRecordAttachments,
  };
};

export { getAttachmentMigrationMappings };
