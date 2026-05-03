jest.mock("./supabase", () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

import * as FileSystem from "expo-file-system/legacy";

import {
  buildCloudRecordAttachmentPayload,
  decodeBase64ToArrayBuffer,
  getCloudRecordAttachmentMetadataWriteErrorMessage,
  getCloudRecordAttachmentDuplicateState,
  insertCloudAttachmentMetadataWithUploadCleanup,
  mapCloudRecordAttachmentRow,
  verifyLocalAttachmentFileForUpload,
} from "./cloudRecordAttachments";
import type { CloudRecordAttachmentRow } from "./cloudRecordAttachments";
import { supabase } from "./supabase";

const now = "2026-05-02T00:00:00.000Z";
const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync);
const mockFrom = jest.mocked((supabase as unknown as { from: jest.Mock }).from);
const mockStorageFrom = jest.mocked(
  (supabase as unknown as { storage: { from: jest.Mock } }).storage.from,
);

const createInsertMetadataBuilder = ({
  error = null,
  row,
}: {
  error?: { code?: string; message: string } | null;
  row: Record<string, unknown>;
}) => {
  type InsertBuilder = {
    insert: jest.MockedFunction<() => InsertBuilder>;
    select: jest.MockedFunction<() => InsertBuilder>;
    single: jest.MockedFunction<
      () => Promise<{
        data: Record<string, unknown> | null;
        error: typeof error;
      }>
    >;
  };
  const builder = {} as InsertBuilder;

  builder.insert = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.single = jest.fn(async () => ({
    data: error ? null : row,
    error,
  }));

  return builder;
};

const createStorageRemoveBuilder = ({
  error = null,
}: {
  error?: { message: string } | null;
}) => ({
  remove: jest.fn(async () => ({ error })),
});

const buildExpectedPayload = () =>
  buildCloudRecordAttachmentPayload({
    input: {
      file_name: "receipt.pdf",
      file_size_bytes: 2048,
      file_type: "pdf",
      local_uri: "file:///local/receipt.pdf",
      mime_type: "application/pdf",
      service_record_id: "cloud_service_1",
      vehicle_id: "cloud_vehicle_1",
    },
    localId: "guest_attachment_1",
    parentRecord: {
      id: "cloud_service_1",
      user_id: "user_1",
      vehicle_id: "cloud_vehicle_1",
    },
    recordType: "service",
    uploadedSize: 2048,
  });

const existingFileInfo = (uri: string, size: number) => ({
  exists: true as const,
  isDirectory: false,
  modificationTime: 0,
  size,
  uri,
});

const missingFileInfo = (uri: string) => ({
  exists: false as const,
  isDirectory: false as const,
  uri,
});

describe("cloud record attachment mapping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInfoAsync.mockResolvedValue(
      existingFileInfo("file:///local/receipt.pdf", 2048),
    );
  });

  it("builds migrated attachment payloads with the preserved local_id", () => {
    const payload = buildExpectedPayload();

    expect(payload).toMatchObject({
      file_name: "receipt.pdf",
      file_size_bytes: 2048,
      local_id: "guest_attachment_1",
      local_uri: null,
      repair_record_id: null,
      service_record_id: "cloud_service_1",
      storage_bucket: "record-attachments",
      storage_path:
        "user_1/vehicles/cloud_vehicle_1/service-records/cloud_service_1/guest_attachment_1-receipt.pdf",
      sync_status: "synced",
      user_id: "user_1",
      vehicle_id: "cloud_vehicle_1",
    });
  });

  it("decodes base64 local files into uploadable bytes", () => {
    const bytes = new Uint8Array(decodeBase64ToArrayBuffer("AQIDBA=="));

    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it("treats matching user_id and local_id metadata as already migrated", () => {
    const expected = buildExpectedPayload();
    const existing = {
      ...expected,
      created_at: now,
      id: "cloud_attachment_1",
      ocr_processed_at: null,
      ocr_text: null,
      ocr_vendor: null,
      updated_at: now,
    };

    expect(
      getCloudRecordAttachmentDuplicateState({ existing, expected }),
    ).toEqual({
      reason: null,
      status: "already_migrated",
    });
  });

  it("treats same local_id with different path or parent metadata as conflicting", () => {
    const expected = buildExpectedPayload();
    const existing = {
      ...expected,
      created_at: now,
      id: "cloud_attachment_1",
      ocr_processed_at: null,
      ocr_text: null,
      ocr_vendor: null,
      service_record_id: "different_cloud_service",
      updated_at: now,
    };

    expect(
      getCloudRecordAttachmentDuplicateState({ existing, expected }),
    ).toMatchObject({
      status: "conflicting_duplicate",
    });
  });

  it("treats missing metadata as not found for idempotent retry", () => {
    const expected = buildExpectedPayload();

    expect(
      getCloudRecordAttachmentDuplicateState({ existing: null, expected }),
    ).toEqual({
      reason: null,
      status: "not_found",
    });
  });

  it("verifies an available local file before upload", async () => {
    await expect(
      verifyLocalAttachmentFileForUpload({
        fileType: "pdf",
        localUri: "file:///local/receipt.pdf",
      }),
    ).resolves.toEqual({
      errorMessage: null,
      fileSizeBytes: 2048,
      isAvailable: true,
      localUri: "file:///local/receipt.pdf",
    });
    expect(mockGetInfoAsync).toHaveBeenCalledWith("file:///local/receipt.pdf");
  });

  it("blocks upload when the local attachment URI is missing", async () => {
    await expect(
      verifyLocalAttachmentFileForUpload({
        fileType: "pdf",
        localUri: "",
      }),
    ).resolves.toMatchObject({
      errorMessage: "Attachment file URI is missing.",
      fileSizeBytes: null,
      isAvailable: false,
    });
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
  });

  it("blocks upload when the local attachment file is unavailable", async () => {
    mockGetInfoAsync.mockResolvedValueOnce(
      missingFileInfo("file:///local/missing.jpg"),
    );

    await expect(
      verifyLocalAttachmentFileForUpload({
        fileType: "photo",
        localUri: "file:///local/missing.jpg",
      }),
    ).resolves.toMatchObject({
      errorMessage: "Attachment file is no longer available on this device.",
      fileSizeBytes: null,
      isAvailable: false,
    });
  });

  it("blocks upload when the local attachment file is empty", async () => {
    mockGetInfoAsync.mockResolvedValueOnce(
      existingFileInfo("file:///local/empty.jpg", 0),
    );

    await expect(
      verifyLocalAttachmentFileForUpload({
        fileType: "photo",
        localUri: "file:///local/empty.jpg",
      }),
    ).resolves.toMatchObject({
      errorMessage: "Attachment file is empty.",
      fileSizeBytes: 0,
      isAvailable: false,
    });
  });

  it("blocks upload when the local attachment file is over the size limit", async () => {
    mockGetInfoAsync.mockResolvedValueOnce(
      existingFileInfo("file:///local/large.pdf", 26 * 1024 * 1024),
    );

    await expect(
      verifyLocalAttachmentFileForUpload({
        fileType: "pdf",
        localUri: "file:///local/large.pdf",
      }),
    ).resolves.toMatchObject({
      errorMessage: "PDF attachments must be 25 MB or smaller.",
      fileSizeBytes: 26 * 1024 * 1024,
      isAvailable: false,
    });
  });

  it("blocks upload when the local attachment file check fails", async () => {
    mockGetInfoAsync.mockRejectedValueOnce(new Error("permission denied"));

    await expect(
      verifyLocalAttachmentFileForUpload({
        fileType: "pdf",
        localUri: "file:///local/receipt.pdf",
      }),
    ).resolves.toMatchObject({
      errorMessage:
        "Attachment file could not be checked before upload. permission denied",
      fileSizeBytes: null,
      isAvailable: false,
    });
  });

  it("saves metadata without cleanup when the metadata insert succeeds", async () => {
    const payload = buildExpectedPayload();
    const row = {
      ...payload,
      created_at: now,
      id: "cloud_attachment_1",
      ocr_processed_at: null,
      ocr_text: null,
      ocr_vendor: null,
      updated_at: now,
    };
    const insertBuilder = createInsertMetadataBuilder({ row });
    mockFrom.mockReturnValueOnce(insertBuilder);

    const result = await insertCloudAttachmentMetadataWithUploadCleanup({
      payload,
    });

    expect(result).toMatchObject({
      attachment: expect.objectContaining({
        id: "cloud_attachment_1",
        local_id: "guest_attachment_1",
      }),
      cleanupErrorMessage: null,
      errorMessage: null,
      status: "saved",
      storagePath: payload.storage_path,
    });
    expect(insertBuilder.insert).toHaveBeenCalledWith(payload);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("reports cleanup success when metadata insert fails after upload", async () => {
    const payload = buildExpectedPayload();
    const insertBuilder = createInsertMetadataBuilder({
      error: { message: "duplicate key value violates unique constraint" },
      row: {},
    });
    const removeBuilder = createStorageRemoveBuilder({});
    mockFrom.mockReturnValueOnce(insertBuilder);
    mockStorageFrom.mockReturnValueOnce(removeBuilder);

    const result = await insertCloudAttachmentMetadataWithUploadCleanup({
      payload,
    });

    expect(result).toMatchObject({
      attachment: null,
      cleanupErrorMessage: null,
      status: "metadata_insert_failed_cleanup_succeeded",
      storagePath: payload.storage_path,
    });
    expect(result.errorMessage).toContain(
      "Attachment uploaded, but metadata could not be saved.",
    );
    expect(removeBuilder.remove).toHaveBeenCalledWith([payload.storage_path]);
  });

  it("reports cleanup failure when metadata insert fails and uploaded file cannot be removed", async () => {
    const warnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const payload = buildExpectedPayload();
    const insertBuilder = createInsertMetadataBuilder({
      error: { message: "metadata insert failed" },
      row: {},
    });
    const removeBuilder = createStorageRemoveBuilder({
      error: { message: "storage cleanup failed" },
    });
    mockFrom.mockReturnValueOnce(insertBuilder);
    mockStorageFrom.mockReturnValueOnce(removeBuilder);

    const result = await insertCloudAttachmentMetadataWithUploadCleanup({
      payload,
    });

    expect(result).toMatchObject({
      attachment: null,
      status: "metadata_insert_failed_cleanup_failed",
      storagePath: payload.storage_path,
    });
    expect(result.cleanupErrorMessage).toContain("storage cleanup failed");
    expect(
      getCloudRecordAttachmentMetadataWriteErrorMessage(result),
    ).toContain("could not be cleaned up automatically");
    warnSpy.mockRestore();
  });

  it("maps Supabase attachment rows into app attachment types", () => {
    const row: CloudRecordAttachmentRow = {
      created_at: now,
      file_name: "receipt.pdf",
      file_size_bytes: 1024,
      file_type: "pdf",
      id: "6e9afae1-4c23-4dc1-8b19-7d3fbf67bb4b",
      local_id: "cloud_att_1",
      local_uri: null,
      mime_type: "application/pdf",
      ocr_processed_at: null,
      ocr_status: "not_started",
      ocr_text: null,
      ocr_vendor: null,
      repair_record_id: null,
      service_record_id: "9c8a3303-1284-4693-85fe-fbaee6be683c",
      storage_bucket: "record-attachments",
      storage_path:
        "user_1/vehicles/veh_1/service-records/svc_1/cloud_att_1-receipt.pdf",
      sync_status: "synced",
      updated_at: now,
      user_id: "0e85579d-86ac-4d1b-9a53-8f89e91d2d25",
      vehicle_id: "65a2848e-6017-4a53-820d-88f46902785c",
    };

    expect(mapCloudRecordAttachmentRow(row)).toMatchObject({
      file_name: "receipt.pdf",
      file_type: "pdf",
      local_uri: null,
      ocr_status: "not_started",
      storage_bucket: "record-attachments",
      sync_status: "synced",
    });
  });
});
