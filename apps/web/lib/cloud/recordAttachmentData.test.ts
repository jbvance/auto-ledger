import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CloudRecordAttachmentRow } from "./mappers";
import {
  createSignedUrlForCloudAttachment,
  listWebCloudAttachmentsForServiceRecord,
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
  rows: {
    record_attachments: [],
    repair_records: [],
    service_records: [],
  } as MockRows,
}));

vi.mock("../supabase/server", () => ({
  createClient: mocks.createClient,
}));

class MockSupabaseQuery {
  private filters: Filter[] = [];

  constructor(private readonly table: TableName) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
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

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
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
    mocks.rows.record_attachments = [];
    mocks.rows.repair_records = [];
    mocks.rows.service_records = [];
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
});
