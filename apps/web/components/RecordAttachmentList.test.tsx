import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RecordAttachment } from "@autoledger/shared";

vi.mock("lucide-react", () => ({
  ExternalLink: () => <span data-testid="external-link-icon" />,
  FileText: () => <span data-testid="file-text-icon" />,
}));

import {
  getWebRecordAttachmentDisplayMetadata,
  RecordAttachmentSection,
} from "./RecordAttachmentList";

const createAttachment = (
  overrides: Partial<RecordAttachment> = {},
): RecordAttachment => ({
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
  vehicle_id: "vehicle-1",
  ...overrides,
});

describe("web record attachment section", () => {
  it("shows the service record attachment empty state", () => {
    const html = renderToStaticMarkup(
      <RecordAttachmentSection
        attachments={[]}
        description="Private cloud receipts and documents attached to this service record."
        getAttachmentHref={() => "/open"}
      />,
    );

    expect(html).toContain("Attachments");
    expect(html).toContain("No receipts or documents attached yet.");
  });

  it("renders service record attachment rows", () => {
    const html = renderToStaticMarkup(
      <RecordAttachmentSection
        attachments={[createAttachment()]}
        description="Private cloud receipts and documents attached to this service record."
        getAttachmentHref={(attachment) =>
          `/vehicles/vehicle-1/service-records/service-1/attachments/${attachment.id}/open`
        }
      />,
    );

    expect(html).toContain("receipt.pdf");
    expect(html).toContain("PDF - 2 KB");
    expect(html).toContain("application/pdf");
    expect(html).toContain(
      "/vehicles/vehicle-1/service-records/service-1/attachments/attachment-1/open",
    );
    expect(html).toContain("Open");
  });

  it("renders repair record attachment rows", () => {
    const html = renderToStaticMarkup(
      <RecordAttachmentSection
        attachments={[
          createAttachment({
            file_name: "brake-photo.jpg",
            file_size_bytes: 1_572_864,
            file_type: "photo",
            id: "repair-attachment-1",
            mime_type: "image/jpeg",
            repair_record_id: "repair-1",
            service_record_id: null,
          }),
        ]}
        description="Private cloud receipts and documents attached to this repair record."
        getAttachmentHref={(attachment) =>
          `/vehicles/vehicle-1/repair-records/repair-1/attachments/${attachment.id}/open`
        }
      />,
    );

    expect(html).toContain("brake-photo.jpg");
    expect(html).toContain("Photo - 1.5 MB");
    expect(html).toContain("image/jpeg");
    expect(html).toContain(
      "/vehicles/vehicle-1/repair-records/repair-1/attachments/repair-attachment-1/open",
    );
  });

  it("formats attachment display metadata", () => {
    expect(
      getWebRecordAttachmentDisplayMetadata(createAttachment()),
    ).toMatchObject({
      createdLabel: "Jan 2, 2026",
      displayName: "receipt.pdf",
      fileSizeLabel: "2 KB",
      fileTypeLabel: "PDF",
      mimeTypeLabel: "application/pdf",
    });
  });
});
