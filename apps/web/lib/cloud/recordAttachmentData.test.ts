import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CloudRecordAttachmentRow } from "./mappers";
import {
  buildWebCloudRecordAttachmentPayload,
  createSignedUrlForCloudAttachment,
  deleteWebCloudAttachment,
  insertWebCloudAttachmentMetadataWithUploadCleanup,
  listWebCloudAttachmentsForServiceRecord,
  uploadWebCloudAttachmentForRepairRecord,
  uploadWebCloudAttachmentForServiceRecord,
  validateWebCloudAttachmentFile,
} from "./recordAttachmentData";

type TableName = "record_attachments" | "repair_records" | "service_records";

type Filter = {
  column: string;
  value: unknown;
};

type MockRows = Record<TableName, Array<Record<string, unknown>>>;

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createSignedUrl: vi.fn(),
  deleteError: null as null | { message: string },
  insertError: null as null | { code?: string; message: string },
  lastDeleteFilters: [] as Filter[],
  lastInsertPayload: null as null | Record<string, unknown>,
  lastUploadedPath: null as null | string,
  remove: vi.fn(),
  removeError: null as null | { message: string; statusCode?: number | string },
  rows: {
    record_attachments: [],
    repair_records: [],
    service_records: [],
  } as MockRows,
  upload: vi.fn(),
  uploadError: null as null | { message: string },
}));

vi.mock("../supabase/server", () => ({
  createClient: mocks.createClient,
}));

class MockSupabaseQuery {
  private filters: Filter[] = [];
  private isDelete = false;

  constructor(private readonly table: TableName) {}

  delete() {
    this.isDelete = true;

    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  insert(payload: Record<string, unknown>) {
    mocks.lastInsertPayload = payload;

    return this;
  }

  maybeSingle() {
    return Promise.resolve({
      data: this.getRows()[0] ?? null,
      error: null,
    });
  }

  order() {
    return this;
  }

  select() {
    return this;
  }

  single() {
    return Promise.resolve({
      data: mocks.insertError ? null : this.getRows()[0],
      error: mocks.insertError,
    });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    if (this.isDelete) {
      mocks.lastDeleteFilters = this.filters;

      return Promise.resolve({
        error: mocks.deleteError,
      }).then(onfulfilled, onrejected);
    }

    return Promise.resolve({
      data: this.getRows(),
      error: null,
    }).then(onfulfilled, onrejected);
  }

  private getRows() {
    return mocks.rows[this.table].filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value),
    );
  }
}

const createMockSupabaseClient = () => ({
  from: (table: TableName) => new MockSupabaseQuery(table),
  storage: {
    from: vi.fn(() => ({
      createSignedUrl: mocks.createSignedUrl,
      remove: mocks.remove,
      upload: mocks.upload,
    })),
  },
});

const createAttachmentRow = (
  overrides: Partial<CloudRecordAttachmentRow> = {},
): CloudRecordAttachmentRow => ({
  created_at: "2026-01-02T12:00:00.000Z",
  file_name: "receipt.pdf",
  file_size_bytes: 2048,
  file_type: "pdf",
  id: "attachment-1",
  local_id: "cloud_attachment_1",
  local_uri: null,
  mime_type: "application/pdf",
  ocr_processed_at: null,
  ocr_status: "not_started",
  ocr_text: null,
  ocr_vendor: null,
  repair_record_id: null,
  service_record_id: "service-1",
  storage_bucket: "record-attachments",
  storage_path:
    "user-1/vehicles/vehicle-1/service-records/service-1/cloud_attachment_1-receipt.pdf",
  sync_status: "synced",
  updated_at: "2026-01-02T12:00:00.000Z",
  user_id: "user-1",
  vehicle_id: "vehicle-1",
  ...overrides,
});

describe("web cloud record attachment data", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(createMockSupabaseClient());
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.supabase.co/signed/receipt.pdf" },
      error: null,
    });
    mocks.deleteError = null;
    mocks.insertError = null;
    mocks.lastDeleteFilters = [];
    mocks.lastInsertPayload = null;
    mocks.lastUploadedPath = null;
    mocks.remove.mockImplementation(async () => ({
      error: mocks.removeError,
    }));
    mocks.removeError = null;
    mocks.rows.record_attachments = [];
    mocks.rows.repair_records = [];
    mocks.rows.service_records = [];
    mocks.upload.mockImplementation(async (path: string) => {
      mocks.lastUploadedPath = path;

      return {
        error: mocks.uploadError,
      };
    });
    mocks.uploadError = null;
  });

  it("validates web attachment file types and size limits", () => {
    expect(() =>
      validateWebCloudAttachmentFile({
        arrayBuffer: async () => new ArrayBuffer(1),
        name: "receipt.bmp",
        size: 1024,
        type: "image/bmp",
      } as File),
    ).toThrow("Attach a JPEG, PNG, WebP, GIF, or PDF file.");

    expect(() =>
      validateWebCloudAttachmentFile({
        arrayBuffer: async () => new ArrayBuffer(1),
        name: "large.pdf",
        size: 26 * 1024 * 1024,
        type: "application/pdf",
      } as File),
    ).toThrow("PDF attachments must be 25 MB or smaller.");

    expect(
      validateWebCloudAttachmentFile({
        arrayBuffer: async () => new ArrayBuffer(1),
        name: "receipt.pdf",
        size: 2048,
        type: "application/pdf",
      } as File),
    ).toMatchObject({
      fileName: "receipt.pdf",
      fileSizeBytes: 2048,
      fileType: "pdf",
      mimeType: "application/pdf",
    });
  });

  it("builds sanitized user-scoped web upload payloads", () => {
    const payload = buildWebCloudRecordAttachmentPayload({
      attachmentFile: {
        fileName: "receipt May/2026.pdf",
        fileSizeBytes: 2048,
        fileType: "pdf",
        mimeType: "application/pdf",
      },
      localId: "att/1",
      parentRecord: {
        id: "service/1",
        user_id: "user/1",
        vehicle_id: "vehicle 1",
      },
      recordType: "service",
    });

    expect(payload).toMatchObject({
      file_name: "receipt May/2026.pdf",
      file_size_bytes: 2048,
      local_id: "att/1",
      local_uri: null,
      service_record_id: "service/1",
      storage_bucket: "record-attachments",
      storage_path:
        "user_1/vehicles/vehicle_1/service-records/service_1/att_1-receipt_May_2026.pdf",
      user_id: "user/1",
      vehicle_id: "vehicle 1",
    });
  });

  it("lists attachments for an owned service record", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [
      createAttachmentRow(),
      createAttachmentRow({
        id: "other-attachment",
        service_record_id: "service-2",
      }),
    ];

    const attachments = await listWebCloudAttachmentsForServiceRecord({
      serviceRecordId: "service-1",
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.id).toBe("attachment-1");
    expect(attachments[0]?.file_size_bytes).toBe(2048);
  });

  it("creates a signed URL from owned attachment metadata", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [createAttachmentRow()];

    await expect(
      createSignedUrlForCloudAttachment({
        attachmentId: "attachment-1",
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).resolves.toBe("https://example.supabase.co/signed/receipt.pdf");

    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      "user-1/vehicles/vehicle-1/service-records/service-1/cloud_attachment_1-receipt.pdf",
      60 * 10,
    );
  });

  it("returns null when the attachment is missing or not attached to the routed record", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [
      createAttachmentRow({ service_record_id: "service-2" }),
    ];

    await expect(
      createSignedUrlForCloudAttachment({
        attachmentId: "attachment-1",
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).resolves.toBeNull();
  });

  it("surfaces signed URL creation errors with a friendly message", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [createAttachmentRow()];
    mocks.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(
      createSignedUrlForCloudAttachment({
        attachmentId: "attachment-1",
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).rejects.toThrow(
      "Unable to create a private attachment link. Supabase denied access to attachment storage or metadata.",
    );
  });

  it("uploads a service record attachment and inserts metadata", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [createAttachmentRow()];

    await expect(
      uploadWebCloudAttachmentForServiceRecord({
        file: {
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          name: "receipt.pdf",
          size: 2048,
          type: "application/pdf",
        } as File,
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).resolves.toMatchObject({
      id: "attachment-1",
      file_name: "receipt.pdf",
    });

    expect(mocks.lastUploadedPath).toContain(
      "user-1/vehicles/vehicle-1/service-records/service-1/web_att_",
    );
    expect(mocks.lastInsertPayload).toMatchObject({
      file_name: "receipt.pdf",
      file_type: "pdf",
      local_uri: null,
      mime_type: "application/pdf",
      service_record_id: "service-1",
      storage_bucket: "record-attachments",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
    });
  });

  it("uploads a repair record attachment against the repair parent", async () => {
    mocks.rows.repair_records = [
      {
        id: "repair-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [
      createAttachmentRow({
        file_name: "photo.jpg",
        file_type: "photo",
        id: "repair-attachment-1",
        mime_type: "image/jpeg",
        repair_record_id: "repair-1",
        service_record_id: null,
        storage_path:
          "user-1/vehicles/vehicle-1/repair-records/repair-1/web_att_1-photo.jpg",
      }),
    ];

    await expect(
      uploadWebCloudAttachmentForRepairRecord({
        file: {
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          name: "photo.jpg",
          size: 2048,
          type: "image/jpeg",
        } as File,
        repairRecordId: "repair-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).resolves.toMatchObject({
      id: "repair-attachment-1",
      file_name: "photo.jpg",
    });

    expect(mocks.lastUploadedPath).toContain(
      "user-1/vehicles/vehicle-1/repair-records/repair-1/web_att_",
    );
    expect(mocks.lastInsertPayload).toMatchObject({
      file_name: "photo.jpg",
      file_type: "photo",
      mime_type: "image/jpeg",
      repair_record_id: "repair-1",
      service_record_id: null,
      user_id: "user-1",
      vehicle_id: "vehicle-1",
    });
  });

  it("does not insert metadata when storage upload fails", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.uploadError = { message: "upload failed" };

    await expect(
      uploadWebCloudAttachmentForServiceRecord({
        file: {
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          name: "receipt.pdf",
          size: 2048,
          type: "application/pdf",
        } as File,
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).rejects.toThrow("Unable to upload attachment. upload failed");

    expect(mocks.lastInsertPayload).toBeNull();
  });

  it("cleans up uploaded storage when metadata insert fails", async () => {
    mocks.rows.record_attachments = [createAttachmentRow()];
    mocks.insertError = { message: "metadata insert failed" };
    const payload = buildWebCloudRecordAttachmentPayload({
      attachmentFile: {
        fileName: "receipt.pdf",
        fileSizeBytes: 2048,
        fileType: "pdf",
        mimeType: "application/pdf",
      },
      localId: "web_att_1",
      parentRecord: {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
      recordType: "service",
    });

    await expect(
      insertWebCloudAttachmentMetadataWithUploadCleanup({ payload }),
    ).rejects.toThrow(
      "Attachment uploaded, but metadata could not be saved. metadata insert failed",
    );

    expect(mocks.remove).toHaveBeenCalledWith([payload.storage_path]);
  });

  it("reports cleanup failure when metadata insert and storage cleanup both fail", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.rows.record_attachments = [createAttachmentRow()];
    mocks.insertError = { message: "metadata insert failed" };
    mocks.removeError = { message: "storage cleanup failed" };
    const payload = buildWebCloudRecordAttachmentPayload({
      attachmentFile: {
        fileName: "receipt.pdf",
        fileSizeBytes: 2048,
        fileType: "pdf",
        mimeType: "application/pdf",
      },
      localId: "web_att_1",
      parentRecord: {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
      recordType: "service",
    });

    await expect(
      insertWebCloudAttachmentMetadataWithUploadCleanup({ payload }),
    ).rejects.toThrow("could not be removed automatically");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("deletes storage and metadata for a routed service record attachment", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [createAttachmentRow()];

    await expect(
      deleteWebCloudAttachment({
        attachmentId: "attachment-1",
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).resolves.toBe("deleted");

    expect(mocks.remove).toHaveBeenCalledWith([
      "user-1/vehicles/vehicle-1/service-records/service-1/cloud_attachment_1-receipt.pdf",
    ]);
    expect(mocks.lastDeleteFilters).toEqual([
      { column: "id", value: "attachment-1" },
      { column: "user_id", value: "user-1" },
      { column: "vehicle_id", value: "vehicle-1" },
      { column: "service_record_id", value: "service-1" },
    ]);
  });

  it("does not delete metadata when storage removal fails", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [createAttachmentRow()];
    mocks.removeError = { message: "permission denied" };

    await expect(
      deleteWebCloudAttachment({
        attachmentId: "attachment-1",
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).rejects.toThrow("Unable to delete the attachment file");

    expect(mocks.lastDeleteFilters).toEqual([]);
  });

  it("deletes orphaned metadata when the storage object is already missing", async () => {
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [createAttachmentRow()];
    mocks.removeError = { message: "Object not found", statusCode: 404 };

    await expect(
      deleteWebCloudAttachment({
        attachmentId: "attachment-1",
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).resolves.toBe("storage_already_missing");

    expect(mocks.lastDeleteFilters).toContainEqual({
      column: "id",
      value: "attachment-1",
    });
  });

  it("reports metadata delete failure after storage delete without claiming success", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.rows.service_records = [
      {
        id: "service-1",
        user_id: "user-1",
        vehicle_id: "vehicle-1",
      },
    ];
    mocks.rows.record_attachments = [createAttachmentRow()];
    mocks.deleteError = { message: "metadata delete failed" };

    await expect(
      deleteWebCloudAttachment({
        attachmentId: "attachment-1",
        serviceRecordId: "service-1",
        userId: "user-1",
        vehicleId: "vehicle-1",
      }),
    ).rejects.toThrow(
      "The attachment file was removed, but its record could not be cleared. Please try again.",
    );

    expect(warnSpy).toHaveBeenCalledWith(
      "Web attachment file removed but metadata delete failed.",
      {
        attachmentId: "attachment-1",
        operation: "delete_web_cloud_attachment",
      },
    );
    warnSpy.mockRestore();
  });
});
