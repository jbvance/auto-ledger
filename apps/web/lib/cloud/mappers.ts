import type {
  MaintenanceReminder,
  OdometerEntry,
  RecordAttachment,
  RepairRecord,
  ServiceRecord,
  Vehicle,
} from "@autoledger/shared";

export type CloudVehicleRow = Omit<
  Vehicle,
  "odometer_unit" | "sync_status" | "vehicle_type"
> & {
  odometer_unit: string;
  sync_status: string;
  user_id: string;
  vehicle_type: string;
};

export type CloudOdometerEntryRow = Omit<
  OdometerEntry,
  "odometer_unit" | "source_type" | "sync_status"
> & {
  odometer_unit: string;
  source_type: string;
  sync_status: string;
  user_id: string;
};

export type CloudServiceRecordRow = Omit<
  ServiceRecord,
  "category" | "cost_amount" | "sync_status"
> & {
  category: string;
  cost_amount: number | string | null;
  sync_status: string;
  user_id: string;
  vendor_id: string | null;
};

export type CloudRepairRecordRow = Omit<
  RepairRecord,
  "category" | "cost_amount" | "sync_status"
> & {
  category: string;
  cost_amount: number | string | null;
  sync_status: string;
  user_id: string;
  vendor_id: string | null;
};

export type CloudMaintenanceReminderRow = Omit<
  MaintenanceReminder,
  "category" | "reminder_type" | "sync_status"
> & {
  category: string;
  reminder_type: string;
  sync_status: string;
  user_id: string;
};

export type CloudRecordAttachmentRow = Omit<
  RecordAttachment,
  "file_size_bytes" | "file_type" | "ocr_status" | "sync_status"
> & {
  file_size_bytes: number | string | null;
  file_type: string;
  ocr_status: string;
  sync_status: string;
  user_id: string;
};

export const vehicleSelect = `
  id,
  user_id,
  local_id,
  nickname,
  make,
  model,
  year,
  trim,
  vin,
  license_plate,
  license_state,
  color,
  vehicle_type,
  initial_odometer,
  current_odometer,
  odometer_unit,
  purchase_date,
  purchase_odometer,
  notes,
  archived_at,
  created_at,
  updated_at,
  sync_status
`;

export const odometerEntrySelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  reading,
  reading_date,
  odometer_unit,
  source_type,
  notes,
  created_at,
  updated_at,
  sync_status
`;

export const serviceRecordSelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  service_date,
  odometer_reading,
  title,
  category,
  description,
  vendor_id,
  vendor_name,
  cost_amount,
  cost_currency,
  notes,
  created_at,
  updated_at,
  sync_status
`;

export const repairRecordSelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  repair_date,
  odometer_reading,
  title,
  category,
  description,
  vendor_id,
  vendor_name,
  cost_amount,
  cost_currency,
  warranty_until_date,
  warranty_until_odometer,
  notes,
  created_at,
  updated_at,
  sync_status
`;

export const maintenanceReminderSelect = `
  id,
  user_id,
  vehicle_id,
  local_id,
  title,
  category,
  reminder_type,
  due_date,
  due_odometer,
  repeat_interval_months,
  repeat_interval_miles,
  is_completed,
  completed_at,
  last_triggered_at,
  notes,
  scheduled_notification_id,
  created_at,
  updated_at,
  sync_status
`;

export const recordAttachmentSelect = `
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

const nullableNumber = (value: number | string | null | undefined) =>
  value === null || value === undefined ? value : Number(value);

export const mapCloudVehicleRow = (row: CloudVehicleRow): Vehicle => ({
  ...row,
  odometer_unit: row.odometer_unit as Vehicle["odometer_unit"],
  sync_status: row.sync_status as Vehicle["sync_status"],
  vehicle_type: row.vehicle_type as Vehicle["vehicle_type"],
});

export const mapCloudOdometerEntryRow = (
  row: CloudOdometerEntryRow,
): OdometerEntry => ({
  ...row,
  odometer_unit: row.odometer_unit as OdometerEntry["odometer_unit"],
  source_type: row.source_type as OdometerEntry["source_type"],
  sync_status: row.sync_status as OdometerEntry["sync_status"],
});

export const mapCloudServiceRecordRow = (
  row: CloudServiceRecordRow,
): ServiceRecord => ({
  ...row,
  category: row.category as ServiceRecord["category"],
  cost_amount: nullableNumber(row.cost_amount),
  sync_status: row.sync_status as ServiceRecord["sync_status"],
});

export const mapCloudRepairRecordRow = (
  row: CloudRepairRecordRow,
): RepairRecord => ({
  ...row,
  category: row.category as RepairRecord["category"],
  cost_amount: nullableNumber(row.cost_amount),
  sync_status: row.sync_status as RepairRecord["sync_status"],
});

export const mapCloudMaintenanceReminderRow = (
  row: CloudMaintenanceReminderRow,
): MaintenanceReminder => ({
  ...row,
  category: row.category as MaintenanceReminder["category"],
  reminder_type: row.reminder_type as MaintenanceReminder["reminder_type"],
  sync_status: row.sync_status as MaintenanceReminder["sync_status"],
});

export const mapCloudRecordAttachmentRow = (
  row: CloudRecordAttachmentRow,
): RecordAttachment => ({
  ...row,
  file_size_bytes: nullableNumber(row.file_size_bytes),
  file_type: row.file_type as RecordAttachment["file_type"],
  ocr_status: row.ocr_status as RecordAttachment["ocr_status"],
  sync_status: row.sync_status as RecordAttachment["sync_status"],
});
