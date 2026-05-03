import {
  buildCsv,
  exportMaintenanceRemindersCsv,
  exportOdometerEntriesCsv,
  exportRepairRecordsCsv,
  exportServiceRecordsCsv,
  exportVehiclesCsv,
  type CsvColumn,
  type MaintenanceReminder,
  type OdometerEntry,
  type RecordAttachment,
  type RepairRecord,
  type ServiceRecord,
  type Vehicle,
} from "@autoledger/shared";

import { createClient } from "../supabase/server";
import {
  maintenanceReminderSelect,
  mapCloudMaintenanceReminderRow,
  mapCloudOdometerEntryRow,
  mapCloudRecordAttachmentRow,
  mapCloudRepairRecordRow,
  mapCloudServiceRecordRow,
  mapCloudVehicleRow,
  odometerEntrySelect,
  recordAttachmentSelect,
  repairRecordSelect,
  serviceRecordSelect,
  vehicleSelect,
  type CloudMaintenanceReminderRow,
  type CloudOdometerEntryRow,
  type CloudRecordAttachmentRow,
  type CloudRepairRecordRow,
  type CloudServiceRecordRow,
  type CloudVehicleRow,
} from "./mappers";

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

export type WebCloudCsvExportData = {
  maintenanceReminders: MaintenanceReminder[];
  odometerEntries: OdometerEntry[];
  recordAttachments: RecordAttachment[];
  repairRecords: RepairRecord[];
  serviceRecords: ServiceRecord[];
  vehicles: Vehicle[];
};

export type WebCloudCsvExportDatasetId =
  | "attachment-metadata"
  | "maintenance-reminders"
  | "odometer-entries"
  | "repair-records"
  | "service-records"
  | "vehicles";

export type WebCloudCsvExportFile = {
  description: string;
  fileName: string;
  id: WebCloudCsvExportDatasetId;
  label: string;
};

export const webCloudCsvExportFiles: WebCloudCsvExportFile[] = [
  {
    description: "Vehicle profile rows, including archived vehicles.",
    fileName: "autoledger-vehicles.csv",
    id: "vehicles",
    label: "Vehicles",
  },
  {
    description: "Cloud mileage readings for account vehicles.",
    fileName: "autoledger-odometer-entries.csv",
    id: "odometer-entries",
    label: "Odometer entries",
  },
  {
    description: "Routine maintenance records saved to the account.",
    fileName: "autoledger-service-records.csv",
    id: "service-records",
    label: "Service records",
  },
  {
    description: "Non-routine repair records saved to the account.",
    fileName: "autoledger-repair-records.csv",
    id: "repair-records",
    label: "Repair records",
  },
  {
    description: "Date, mileage, and date-or-mileage reminders.",
    fileName: "autoledger-maintenance-reminders.csv",
    id: "maintenance-reminders",
    label: "Maintenance reminders",
  },
  {
    description: "Receipt/document metadata only. File binaries are excluded.",
    fileName: "autoledger-attachment-metadata.csv",
    id: "attachment-metadata",
    label: "Attachment metadata",
  },
];

const webCloudCsvExportFileById = new Map(
  webCloudCsvExportFiles.map((file) => [file.id, file]),
);

const formatCloudExportError = (action: string, error: SupabaseErrorLike) => {
  if (
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("could not find the table") ||
    error.message.toLowerCase().includes("schema cache")
  ) {
    return `${action}. The Supabase cloud tables are not available yet. Run packages/db/sql/002_cloud_data_schema_rls.sql in your Supabase project, then try again.`;
  }

  if (error.message.toLowerCase().includes("permission denied")) {
    return `${action}. Supabase denied access. Confirm authenticated grants and Row Level Security policies are installed.`;
  }

  return `${action}. ${error.message}`;
};

const throwIfError = (
  action: string,
  error: SupabaseErrorLike | null,
): void => {
  if (error) {
    throw new Error(formatCloudExportError(action, error));
  }
};

const emptyWebCloudCsvExportData = (): WebCloudCsvExportData => ({
  maintenanceReminders: [],
  odometerEntries: [],
  recordAttachments: [],
  repairRecords: [],
  serviceRecords: [],
  vehicles: [],
});

export const isWebCloudCsvExportDatasetId = (
  value: string,
): value is WebCloudCsvExportDatasetId =>
  webCloudCsvExportFileById.has(value as WebCloudCsvExportDatasetId);

export const getWebCloudCsvExportFile = (datasetId: string) =>
  isWebCloudCsvExportDatasetId(datasetId)
    ? webCloudCsvExportFileById.get(datasetId)
    : undefined;

export const hasWebCloudCsvExportData = ({
  maintenanceReminders,
  odometerEntries,
  recordAttachments,
  repairRecords,
  serviceRecords,
  vehicles,
}: WebCloudCsvExportData) =>
  vehicles.length > 0 ||
  odometerEntries.length > 0 ||
  serviceRecords.length > 0 ||
  repairRecords.length > 0 ||
  maintenanceReminders.length > 0 ||
  recordAttachments.length > 0;

export const getWebCloudCsvExportSummary = (data: WebCloudCsvExportData) => ({
  hasData: hasWebCloudCsvExportData(data),
  recordCounts: {
    attachmentMetadata: data.recordAttachments.length,
    maintenanceReminders: data.maintenanceReminders.length,
    odometerEntries: data.odometerEntries.length,
    repairRecords: data.repairRecords.length,
    serviceRecords: data.serviceRecords.length,
    vehicles: data.vehicles.length,
  },
});

export const loadWebCloudCsvExportData = async ({
  userId,
}: {
  userId: string;
}): Promise<WebCloudCsvExportData> => {
  const supabase = await createClient();
  const [
    vehicleResult,
    odometerResult,
    serviceResult,
    repairResult,
    reminderResult,
    attachmentResult,
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select(vehicleSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("odometer_entries")
      .select(odometerEntrySelect)
      .eq("user_id", userId)
      .order("reading_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("service_records")
      .select(serviceRecordSelect)
      .eq("user_id", userId)
      .order("service_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("repair_records")
      .select(repairRecordSelect)
      .eq("user_id", userId)
      .order("repair_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("maintenance_reminders")
      .select(maintenanceReminderSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("record_attachments")
      .select(recordAttachmentSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  throwIfError("Unable to export cloud vehicles", vehicleResult.error);
  throwIfError(
    "Unable to export cloud odometer entries",
    odometerResult.error,
  );
  throwIfError("Unable to export cloud service records", serviceResult.error);
  throwIfError("Unable to export cloud repair records", repairResult.error);
  throwIfError(
    "Unable to export cloud maintenance reminders",
    reminderResult.error,
  );
  throwIfError(
    "Unable to export cloud attachment metadata",
    attachmentResult.error,
  );

  return {
    maintenanceReminders: (
      (reminderResult.data ?? []) as CloudMaintenanceReminderRow[]
    ).map(mapCloudMaintenanceReminderRow),
    odometerEntries: (
      (odometerResult.data ?? []) as CloudOdometerEntryRow[]
    ).map(mapCloudOdometerEntryRow),
    recordAttachments: (
      (attachmentResult.data ?? []) as CloudRecordAttachmentRow[]
    ).map(mapCloudRecordAttachmentRow),
    repairRecords: ((repairResult.data ?? []) as CloudRepairRecordRow[]).map(
      mapCloudRepairRecordRow,
    ),
    serviceRecords: (
      (serviceResult.data ?? []) as CloudServiceRecordRow[]
    ).map(mapCloudServiceRecordRow),
    vehicles: ((vehicleResult.data ?? []) as CloudVehicleRow[]).map(
      mapCloudVehicleRow,
    ),
  };
};

const getVehicleLookup = (vehicles: Vehicle[]) =>
  new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

const exportCloudRecordAttachmentsCsv = ({
  recordAttachments,
  repairRecords,
  serviceRecords,
  vehicles,
}: {
  recordAttachments: RecordAttachment[];
  repairRecords: RepairRecord[];
  serviceRecords: ServiceRecord[];
  vehicles: Vehicle[];
}) => {
  const vehicleById = getVehicleLookup(vehicles);
  const serviceRecordById = new Map(
    serviceRecords.map((record) => [record.id, record]),
  );
  const repairRecordById = new Map(
    repairRecords.map((record) => [record.id, record]),
  );
  const columns: Array<CsvColumn<RecordAttachment>> = [
    { header: "attachment_id", value: (attachment) => attachment.id },
    { header: "vehicle_id", value: (attachment) => attachment.vehicle_id },
    {
      header: "vehicle_nickname",
      value: (attachment) =>
        vehicleById.get(attachment.vehicle_id)?.nickname ?? "",
    },
    {
      header: "linked_record_type",
      value: (attachment) =>
        attachment.service_record_id ? "service" : "repair",
    },
    {
      header: "linked_record_id",
      value: (attachment) =>
        attachment.service_record_id ?? attachment.repair_record_id,
    },
    {
      header: "linked_record_title",
      value: (attachment) =>
        attachment.service_record_id
          ? serviceRecordById.get(attachment.service_record_id)?.title
          : attachment.repair_record_id
            ? repairRecordById.get(attachment.repair_record_id)?.title
            : "",
    },
    { header: "file_name", value: (attachment) => attachment.file_name },
    { header: "file_type", value: (attachment) => attachment.file_type },
    { header: "mime_type", value: (attachment) => attachment.mime_type },
    {
      header: "file_size_bytes",
      value: (attachment) => attachment.file_size_bytes,
    },
    {
      header: "storage_bucket",
      value: (attachment) => attachment.storage_bucket,
    },
    { header: "storage_path", value: (attachment) => attachment.storage_path },
    { header: "created_at", value: (attachment) => attachment.created_at },
    { header: "updated_at", value: (attachment) => attachment.updated_at },
  ];

  return buildCsv(columns, recordAttachments);
};

export const exportWebCloudCsvByDataset = ({
  data = emptyWebCloudCsvExportData(),
  datasetId,
}: {
  data?: WebCloudCsvExportData;
  datasetId: WebCloudCsvExportDatasetId;
}) => {
  switch (datasetId) {
    case "attachment-metadata":
      return exportCloudRecordAttachmentsCsv({
        recordAttachments: data.recordAttachments,
        repairRecords: data.repairRecords,
        serviceRecords: data.serviceRecords,
        vehicles: data.vehicles,
      });
    case "maintenance-reminders":
      return exportMaintenanceRemindersCsv({
        maintenanceReminders: data.maintenanceReminders,
        vehicles: data.vehicles,
      });
    case "odometer-entries":
      return exportOdometerEntriesCsv({
        odometerEntries: data.odometerEntries,
        vehicles: data.vehicles,
      });
    case "repair-records":
      return exportRepairRecordsCsv({
        repairRecords: data.repairRecords,
        vehicles: data.vehicles,
      });
    case "service-records":
      return exportServiceRecordsCsv({
        serviceRecords: data.serviceRecords,
        vehicles: data.vehicles,
      });
    case "vehicles":
      return exportVehiclesCsv(data.vehicles);
  }
};

