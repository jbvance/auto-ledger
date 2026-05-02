import {
  decodeBase64ToArrayBuffer,
  mapCloudRecordAttachmentRow,
} from "./cloudRecordAttachments";
import type { CloudRecordAttachmentRow } from "./cloudRecordAttachments";

describe("cloud record attachment mapping", () => {
  it("decodes base64 local files into uploadable bytes", () => {
    const bytes = new Uint8Array(decodeBase64ToArrayBuffer("AQIDBA=="));

    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it("maps Supabase attachment rows into app attachment types", () => {
    const row: CloudRecordAttachmentRow = {
      created_at: "2026-05-02T00:00:00.000Z",
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
      updated_at: "2026-05-02T00:00:00.000Z",
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
