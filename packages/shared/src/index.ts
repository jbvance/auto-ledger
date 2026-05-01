export const appName = "AutoLedger";

export const currentDevelopmentTrack = {
  id: "local_guest_mvp",
  label: "Local guest MVP",
  description:
    "Local guest MVP features complete; cloud account/sync foundation is next.",
} as const;

export const vehicleTypeValues = [
  "car",
  "suv",
  "truck",
  "van",
  "motorcycle",
  "rv",
  "trailer",
  "other",
] as const;

export type VehicleType = (typeof vehicleTypeValues)[number];

export const vehicleTypeLabels: Record<VehicleType, string> = {
  car: "Car",
  suv: "SUV",
  truck: "Truck",
  van: "Van",
  motorcycle: "Motorcycle",
  rv: "RV",
  trailer: "Trailer",
  other: "Other",
};

export const odometerUnitValues = ["mi", "km"] as const;

export type OdometerUnit = (typeof odometerUnitValues)[number];

export const odometerUnitLabels: Record<OdometerUnit, string> = {
  mi: "Miles",
  km: "Kilometers",
};

export const odometerSourceTypeValues = [
  "manual",
  "service_record",
  "repair_record",
  "reminder_completion",
  "import",
] as const;

export type OdometerSourceType = (typeof odometerSourceTypeValues)[number];

export const odometerSourceTypeLabels: Record<OdometerSourceType, string> = {
  manual: "Manual",
  service_record: "Service Record",
  repair_record: "Repair Record",
  reminder_completion: "Reminder Completion",
  import: "Import",
};

export const serviceRecordCategoryValues = [
  "oil_change",
  "tire_rotation",
  "inspection",
  "registration",
  "brakes",
  "battery",
  "fluids",
  "scheduled_maintenance",
  "tires",
  "other",
] as const;

export type ServiceRecordCategory =
  (typeof serviceRecordCategoryValues)[number];

export const serviceRecordCategoryLabels: Record<
  ServiceRecordCategory,
  string
> = {
  oil_change: "Oil Change",
  tire_rotation: "Tire Rotation",
  inspection: "Inspection",
  registration: "Registration",
  brakes: "Brakes",
  battery: "Battery",
  fluids: "Fluids",
  scheduled_maintenance: "Scheduled Maintenance",
  tires: "Tires",
  other: "Other",
};

export const repairRecordCategoryValues = [
  "engine",
  "transmission",
  "electrical",
  "brakes",
  "suspension",
  "body",
  "tires",
  "hvac",
  "diagnostic",
  "other",
] as const;

export type RepairRecordCategory = (typeof repairRecordCategoryValues)[number];

export const repairRecordCategoryLabels: Record<RepairRecordCategory, string> =
  {
    engine: "Engine",
    transmission: "Transmission",
    electrical: "Electrical",
    brakes: "Brakes",
    suspension: "Suspension",
    body: "Body",
    tires: "Tires",
    hvac: "HVAC",
    diagnostic: "Diagnostic",
    other: "Other",
  };

export const recordAttachmentFileTypeValues = ["photo", "pdf"] as const;

export type RecordAttachmentFileType =
  (typeof recordAttachmentFileTypeValues)[number];

export const recordAttachmentFileTypeLabels: Record<
  RecordAttachmentFileType,
  string
> = {
  pdf: "PDF",
  photo: "Photo",
};

export const recordAttachmentFileSizeLimits: Record<
  RecordAttachmentFileType,
  number
> = {
  pdf: 25 * 1024 * 1024,
  photo: 10 * 1024 * 1024,
};

export const recordAttachmentFileSizeLimitLabels: Record<
  RecordAttachmentFileType,
  string
> = {
  pdf: "25 MB",
  photo: "10 MB",
};

export const recordAttachmentOcrStatusValues = [
  "not_started",
  "pending",
  "processed",
  "failed",
] as const;

export type RecordAttachmentOcrStatus =
  (typeof recordAttachmentOcrStatusValues)[number];

export const maintenanceReminderTypeValues = [
  "date",
  "mileage",
  "date_or_mileage",
] as const;

export type MaintenanceReminderType =
  (typeof maintenanceReminderTypeValues)[number];

export const maintenanceReminderTypeLabels: Record<
  MaintenanceReminderType,
  string
> = {
  date: "Date",
  mileage: "Mileage",
  date_or_mileage: "Date or Mileage",
};

export const maintenanceReminderCategoryValues = [
  "oil_change",
  "tire_rotation",
  "inspection",
  "registration",
  "insurance",
  "warranty",
  "battery",
  "brakes",
  "custom",
] as const;

export type MaintenanceReminderCategory =
  (typeof maintenanceReminderCategoryValues)[number];

export const maintenanceReminderCategoryLabels: Record<
  MaintenanceReminderCategory,
  string
> = {
  oil_change: "Oil Change",
  tire_rotation: "Tire Rotation",
  inspection: "Inspection",
  registration: "Registration",
  insurance: "Insurance",
  warranty: "Warranty",
  battery: "Battery",
  brakes: "Brakes",
  custom: "Custom",
};

export type MaintenanceReminderStatus =
  | "upcoming"
  | "due_soon"
  | "overdue"
  | "completed";

export const maintenanceReminderStatusLabels: Record<
  MaintenanceReminderStatus,
  string
> = {
  upcoming: "Upcoming",
  due_soon: "Due Soon",
  overdue: "Overdue",
  completed: "Completed",
};

export const reminderDueSoonThresholds = {
  days: 14,
  miles: 500,
} as const;

export type LocalSyncStatus =
  | "local_only"
  | "pending_upload"
  | "synced"
  | "sync_error";

export type Vehicle = {
  id: string;
  local_id: string;
  nickname: string;
  make: string;
  model: string;
  year: number;
  trim?: string | null;
  vin?: string | null;
  license_plate?: string | null;
  license_state?: string | null;
  color?: string | null;
  vehicle_type: VehicleType;
  initial_odometer: number;
  current_odometer: number;
  odometer_unit: OdometerUnit;
  purchase_date?: string | null;
  purchase_odometer?: number | null;
  notes?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
};

export type VehicleInput = Pick<
  Vehicle,
  | "nickname"
  | "make"
  | "model"
  | "year"
  | "vehicle_type"
  | "current_odometer"
  | "odometer_unit"
> &
  Partial<
    Pick<
      Vehicle,
      | "trim"
      | "vin"
      | "license_plate"
      | "license_state"
      | "color"
      | "purchase_date"
      | "purchase_odometer"
      | "notes"
    >
  >;

export type OdometerEntry = {
  id: string;
  local_id: string;
  vehicle_id: string;
  reading: number;
  reading_date: string;
  odometer_unit: OdometerUnit;
  source_type: OdometerSourceType;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
};

export type OdometerEntryInput = Pick<
  OdometerEntry,
  "vehicle_id" | "reading" | "reading_date" | "odometer_unit" | "source_type"
> &
  Partial<Pick<OdometerEntry, "notes">>;

export type ServiceRecord = {
  id: string;
  local_id: string;
  vehicle_id: string;
  service_date: string;
  odometer_reading?: number | null;
  title: string;
  category: ServiceRecordCategory;
  description?: string | null;
  vendor_name?: string | null;
  cost_amount?: number | null;
  cost_currency: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
};

export type ServiceRecordInput = Pick<
  ServiceRecord,
  "vehicle_id" | "service_date" | "title" | "category" | "cost_currency"
> &
  Partial<
    Pick<
      ServiceRecord,
      | "odometer_reading"
      | "description"
      | "vendor_name"
      | "cost_amount"
      | "notes"
    >
  >;

export type RepairRecord = {
  id: string;
  local_id: string;
  vehicle_id: string;
  repair_date: string;
  odometer_reading?: number | null;
  title: string;
  category: RepairRecordCategory;
  description?: string | null;
  vendor_name?: string | null;
  cost_amount?: number | null;
  cost_currency: string;
  warranty_until_date?: string | null;
  warranty_until_odometer?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
};

export type RepairRecordInput = Pick<
  RepairRecord,
  "vehicle_id" | "repair_date" | "title" | "category" | "cost_currency"
> &
  Partial<
    Pick<
      RepairRecord,
      | "odometer_reading"
      | "description"
      | "vendor_name"
      | "cost_amount"
      | "warranty_until_date"
      | "warranty_until_odometer"
      | "notes"
    >
  >;

export type RecordAttachment = {
  id: string;
  local_id: string;
  vehicle_id: string;
  service_record_id?: string | null;
  repair_record_id?: string | null;
  file_name: string;
  file_type: RecordAttachmentFileType;
  mime_type: string;
  file_size_bytes?: number | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  local_uri: string;
  ocr_status: RecordAttachmentOcrStatus;
  ocr_text?: string | null;
  ocr_vendor?: string | null;
  ocr_processed_at?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
};

export type RecordAttachmentInput = Pick<
  RecordAttachment,
  "file_name" | "file_type" | "local_uri" | "mime_type" | "vehicle_id"
> &
  Partial<
    Pick<
      RecordAttachment,
      | "file_size_bytes"
      | "repair_record_id"
      | "service_record_id"
      | "storage_bucket"
      | "storage_path"
    >
  >;

export type MaintenanceReminder = {
  id: string;
  local_id: string;
  vehicle_id: string;
  title: string;
  category: MaintenanceReminderCategory;
  reminder_type: MaintenanceReminderType;
  due_date?: string | null;
  due_odometer?: number | null;
  repeat_interval_months?: number | null;
  repeat_interval_miles?: number | null;
  is_completed: boolean;
  completed_at?: string | null;
  last_triggered_at?: string | null;
  notes?: string | null;
  scheduled_notification_id?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
};

export type MaintenanceReminderInput = Pick<
  MaintenanceReminder,
  "vehicle_id" | "title" | "category" | "reminder_type"
> &
  Partial<
    Pick<
      MaintenanceReminder,
      | "due_date"
      | "due_odometer"
      | "repeat_interval_months"
      | "repeat_interval_miles"
      | "notes"
    >
  >;

export const formatVehicleTitle = (vehicle: Pick<Vehicle, "nickname">) =>
  vehicle.nickname;

export const formatVehicleSubtitle = (
  vehicle: Pick<Vehicle, "year" | "make" | "model" | "trim">,
) =>
  [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter((part) => part !== undefined && part !== null && `${part}` !== "")
    .join(" ");

export const formatOdometer = (
  reading: number,
  unit: OdometerUnit,
  locale = "en-US",
) => `${new Intl.NumberFormat(locale).format(reading)} ${unit}`;

export const formatDisplayDate = (date: string, locale = "en-US") => {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

export const formatCostAmount = (
  amount: number | null | undefined,
  currency = "USD",
  locale = "en-US",
) => {
  if (amount === null || amount === undefined) {
    return "Not set";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
};

export const formatAttachmentFileSize = (
  sizeInBytes: number | null | undefined,
  locale = "en-US",
) => {
  if (sizeInBytes === null || sizeInBytes === undefined) {
    return "Size unknown";
  }

  if (sizeInBytes < 1024) {
    return `${new Intl.NumberFormat(locale).format(sizeInBytes)} B`;
  }

  if (sizeInBytes < 1_048_576) {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    }).format(sizeInBytes / 1024)} KB`;
  }

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(sizeInBytes / 1_048_576)} MB`;
};

export const formatAttachmentTypeLabel = (fileType: RecordAttachmentFileType) =>
  recordAttachmentFileTypeLabels[fileType];

export const getAttachmentDisplayName = (
  attachment: Pick<RecordAttachment, "file_name">,
) => attachment.file_name.trim() || "Untitled attachment";

export const formatMaintenanceReminderCategory = (
  category: MaintenanceReminderCategory,
) => maintenanceReminderCategoryLabels[category];

const parseDateOnly = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeDateOnly = (date: Date | string) => {
  if (typeof date === "string") {
    return date.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
};

const daysUntilDate = (dueDate: string, today: Date | string) => {
  const due = parseDateOnly(dueDate);
  const current = parseDateOnly(normalizeDateOnly(today));

  if (!due || !current) {
    return null;
  }

  return Math.floor((due.getTime() - current.getTime()) / 86_400_000);
};

type ReminderStatusInput = {
  currentOdometer: number;
  reminder: Pick<
    MaintenanceReminder,
    "due_date" | "due_odometer" | "is_completed" | "reminder_type"
  >;
  thresholds?: {
    days?: number;
    miles?: number;
  };
  today?: Date | string;
};

export const getMaintenanceReminderStatus = ({
  currentOdometer,
  reminder,
  thresholds = reminderDueSoonThresholds,
  today = new Date(),
}: ReminderStatusInput): MaintenanceReminderStatus => {
  if (reminder.is_completed) {
    return "completed";
  }

  const dateDistance =
    reminder.due_date && reminder.reminder_type !== "mileage"
      ? daysUntilDate(reminder.due_date, today)
      : null;
  const mileageDistance =
    reminder.due_odometer !== null &&
    reminder.due_odometer !== undefined &&
    reminder.reminder_type !== "date"
      ? reminder.due_odometer - currentOdometer
      : null;
  const isOverdueByDate = dateDistance !== null && dateDistance < 0;
  const isOverdueByMileage = mileageDistance !== null && mileageDistance <= 0;

  if (isOverdueByDate || isOverdueByMileage) {
    return "overdue";
  }

  const isDueSoonByDate =
    dateDistance !== null && dateDistance <= (thresholds.days ?? 14);
  const isDueSoonByMileage =
    mileageDistance !== null && mileageDistance <= (thresholds.miles ?? 500);

  if (isDueSoonByDate || isDueSoonByMileage) {
    return "due_soon";
  }

  return "upcoming";
};

export const isMaintenanceReminderUpcoming = (input: ReminderStatusInput) =>
  getMaintenanceReminderStatus(input) === "upcoming";

export const isMaintenanceReminderDueSoon = (input: ReminderStatusInput) =>
  getMaintenanceReminderStatus(input) === "due_soon";

export const isMaintenanceReminderOverdue = (input: ReminderStatusInput) =>
  getMaintenanceReminderStatus(input) === "overdue";

export const isMaintenanceReminderCompleted = (
  reminder: Pick<MaintenanceReminder, "is_completed">,
) => reminder.is_completed;

export const getMaintenanceReminderUrgencyRank = (
  status: MaintenanceReminderStatus,
) => {
  const ranks: Record<MaintenanceReminderStatus, number> = {
    overdue: 0,
    due_soon: 1,
    upcoming: 2,
    completed: 3,
  };

  return ranks[status];
};

export const compareMaintenanceRemindersByUrgency = (
  first: MaintenanceReminder,
  second: MaintenanceReminder,
  vehicleOdometers: Record<string, number>,
  today: Date | string = new Date(),
) => {
  const firstStatus = getMaintenanceReminderStatus({
    currentOdometer: vehicleOdometers[first.vehicle_id] ?? 0,
    reminder: first,
    today,
  });
  const secondStatus = getMaintenanceReminderStatus({
    currentOdometer: vehicleOdometers[second.vehicle_id] ?? 0,
    reminder: second,
    today,
  });
  const statusComparison =
    getMaintenanceReminderUrgencyRank(firstStatus) -
    getMaintenanceReminderUrgencyRank(secondStatus);

  if (statusComparison !== 0) {
    return statusComparison;
  }

  const firstDate = first.due_date ?? "9999-12-31";
  const secondDate = second.due_date ?? "9999-12-31";
  const dateComparison = firstDate.localeCompare(secondDate);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const firstOdometer = first.due_odometer ?? Number.MAX_SAFE_INTEGER;
  const secondOdometer = second.due_odometer ?? Number.MAX_SAFE_INTEGER;

  if (firstOdometer !== secondOdometer) {
    return firstOdometer - secondOdometer;
  }

  return second.created_at.localeCompare(first.created_at);
};

type VehicleHistoryBaseItem = {
  categoryLabel?: string;
  cost_amount?: number | null;
  cost_currency?: string;
  created_at: string;
  date: string;
  id: string;
  odometer_reading?: number | null;
  summary?: string | null;
  title: string;
  typeLabel: string;
  vehicle_id: string;
  vendor_name?: string | null;
};

export type VehicleHistoryItem =
  | (VehicleHistoryBaseItem & {
      source: OdometerEntry;
      type: "odometer";
      typeLabel: "Odometer";
    })
  | (VehicleHistoryBaseItem & {
      source: ServiceRecord;
      type: "service";
      typeLabel: "Service";
    })
  | (VehicleHistoryBaseItem & {
      source: RepairRecord;
      type: "repair";
      typeLabel: "Repair";
    });

type BuildVehicleHistoryItemsInput = {
  odometerEntries: OdometerEntry[];
  repairRecords: RepairRecord[];
  serviceRecords: ServiceRecord[];
};

export const buildVehicleHistoryItems = ({
  odometerEntries,
  repairRecords,
  serviceRecords,
}: BuildVehicleHistoryItemsInput): VehicleHistoryItem[] => {
  const historyItems: VehicleHistoryItem[] = [
    ...odometerEntries.map(
      (entry): VehicleHistoryItem => ({
        categoryLabel: odometerSourceTypeLabels[entry.source_type],
        created_at: entry.created_at,
        date: entry.reading_date,
        id: entry.id,
        odometer_reading: entry.reading,
        source: entry,
        summary: entry.notes,
        title: "Odometer reading",
        type: "odometer",
        typeLabel: "Odometer",
        vehicle_id: entry.vehicle_id,
      }),
    ),
    ...serviceRecords.map(
      (record): VehicleHistoryItem => ({
        categoryLabel: serviceRecordCategoryLabels[record.category],
        cost_amount: record.cost_amount,
        cost_currency: record.cost_currency,
        created_at: record.created_at,
        date: record.service_date,
        id: record.id,
        odometer_reading: record.odometer_reading,
        source: record,
        summary: record.description || record.notes,
        title: record.title,
        type: "service",
        typeLabel: "Service",
        vehicle_id: record.vehicle_id,
        vendor_name: record.vendor_name,
      }),
    ),
    ...repairRecords.map(
      (record): VehicleHistoryItem => ({
        categoryLabel: repairRecordCategoryLabels[record.category],
        cost_amount: record.cost_amount,
        cost_currency: record.cost_currency,
        created_at: record.created_at,
        date: record.repair_date,
        id: record.id,
        odometer_reading: record.odometer_reading,
        source: record,
        summary: record.description || record.notes,
        title: record.title,
        type: "repair",
        typeLabel: "Repair",
        vehicle_id: record.vehicle_id,
        vendor_name: record.vendor_name,
      }),
    ),
  ];

  return historyItems.sort((first, second) => {
    const dateComparison = second.date.localeCompare(first.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return second.created_at.localeCompare(first.created_at);
  });
};

export type NavigationSection = {
  label: string;
  description: string;
};

export const statusNavigation: NavigationSection[] = [
  {
    label: "Dashboard",
    description:
      "Mobile dashboard supports local summaries, vehicle cards, reminders, and recent activity.",
  },
  {
    label: "Vehicles",
    description:
      "Guest vehicle tracking works locally on this device without requiring an account.",
  },
  {
    label: "Records",
    description:
      "Local odometer entries, service records, repair records, and unified history are working.",
  },
  {
    label: "Settings",
    description:
      "Local reminders, notification settings, attachments, and CSV export are available; cloud sync is next.",
  },
];

export type CsvCellValue = boolean | number | string | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvCellValue;
};

export const escapeCsvValue = (value: CsvCellValue) => {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  const mustQuote =
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r");

  if (!mustQuote) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
};

export const buildCsv = <T>(columns: CsvColumn<T>[], rows: T[]) => {
  const headerRow = columns.map((column) => escapeCsvValue(column.header));
  const dataRows = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))),
  );

  return [headerRow, ...dataRows].map((cells) => cells.join(",")).join("\n");
};

const getVehicleLookup = (vehicles: Vehicle[]) =>
  new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

const getVehicleNickname = (
  vehicleById: Map<string, Vehicle>,
  vehicleId: string,
) => vehicleById.get(vehicleId)?.nickname ?? "";

export const exportVehiclesCsv = (vehicles: Vehicle[]) =>
  buildCsv<Vehicle>(
    [
      { header: "vehicle_id", value: (vehicle) => vehicle.id },
      { header: "nickname", value: (vehicle) => vehicle.nickname },
      { header: "year", value: (vehicle) => vehicle.year },
      { header: "make", value: (vehicle) => vehicle.make },
      { header: "model", value: (vehicle) => vehicle.model },
      { header: "trim", value: (vehicle) => vehicle.trim },
      { header: "vin", value: (vehicle) => vehicle.vin },
      { header: "license_plate", value: (vehicle) => vehicle.license_plate },
      { header: "license_state", value: (vehicle) => vehicle.license_state },
      { header: "color", value: (vehicle) => vehicle.color },
      { header: "vehicle_type", value: (vehicle) => vehicle.vehicle_type },
      {
        header: "initial_odometer",
        value: (vehicle) => vehicle.initial_odometer,
      },
      {
        header: "current_odometer",
        value: (vehicle) => vehicle.current_odometer,
      },
      { header: "odometer_unit", value: (vehicle) => vehicle.odometer_unit },
      { header: "purchase_date", value: (vehicle) => vehicle.purchase_date },
      {
        header: "purchase_odometer",
        value: (vehicle) => vehicle.purchase_odometer,
      },
      { header: "archived_at", value: (vehicle) => vehicle.archived_at },
      { header: "notes", value: (vehicle) => vehicle.notes },
      { header: "created_at", value: (vehicle) => vehicle.created_at },
      { header: "updated_at", value: (vehicle) => vehicle.updated_at },
    ],
    vehicles,
  );

export const exportOdometerEntriesCsv = ({
  odometerEntries,
  vehicles,
}: {
  odometerEntries: OdometerEntry[];
  vehicles: Vehicle[];
}) => {
  const vehicleById = getVehicleLookup(vehicles);

  return buildCsv<OdometerEntry>(
    [
      { header: "entry_id", value: (entry) => entry.id },
      { header: "vehicle_id", value: (entry) => entry.vehicle_id },
      {
        header: "vehicle_nickname",
        value: (entry) => getVehicleNickname(vehicleById, entry.vehicle_id),
      },
      { header: "reading_date", value: (entry) => entry.reading_date },
      { header: "reading", value: (entry) => entry.reading },
      { header: "odometer_unit", value: (entry) => entry.odometer_unit },
      { header: "source_type", value: (entry) => entry.source_type },
      { header: "notes", value: (entry) => entry.notes },
      { header: "created_at", value: (entry) => entry.created_at },
      { header: "updated_at", value: (entry) => entry.updated_at },
    ],
    odometerEntries,
  );
};

export const exportServiceRecordsCsv = ({
  serviceRecords,
  vehicles,
}: {
  serviceRecords: ServiceRecord[];
  vehicles: Vehicle[];
}) => {
  const vehicleById = getVehicleLookup(vehicles);

  return buildCsv<ServiceRecord>(
    [
      { header: "service_record_id", value: (record) => record.id },
      { header: "vehicle_id", value: (record) => record.vehicle_id },
      {
        header: "vehicle_nickname",
        value: (record) => getVehicleNickname(vehicleById, record.vehicle_id),
      },
      { header: "service_date", value: (record) => record.service_date },
      {
        header: "odometer_reading",
        value: (record) => record.odometer_reading,
      },
      { header: "title", value: (record) => record.title },
      { header: "category", value: (record) => record.category },
      { header: "vendor_name", value: (record) => record.vendor_name },
      { header: "cost_amount", value: (record) => record.cost_amount },
      { header: "cost_currency", value: (record) => record.cost_currency },
      { header: "description", value: (record) => record.description },
      { header: "notes", value: (record) => record.notes },
      { header: "created_at", value: (record) => record.created_at },
      { header: "updated_at", value: (record) => record.updated_at },
    ],
    serviceRecords,
  );
};

export const exportRepairRecordsCsv = ({
  repairRecords,
  vehicles,
}: {
  repairRecords: RepairRecord[];
  vehicles: Vehicle[];
}) => {
  const vehicleById = getVehicleLookup(vehicles);

  return buildCsv<RepairRecord>(
    [
      { header: "repair_record_id", value: (record) => record.id },
      { header: "vehicle_id", value: (record) => record.vehicle_id },
      {
        header: "vehicle_nickname",
        value: (record) => getVehicleNickname(vehicleById, record.vehicle_id),
      },
      { header: "repair_date", value: (record) => record.repair_date },
      {
        header: "odometer_reading",
        value: (record) => record.odometer_reading,
      },
      { header: "title", value: (record) => record.title },
      { header: "category", value: (record) => record.category },
      { header: "vendor_name", value: (record) => record.vendor_name },
      { header: "cost_amount", value: (record) => record.cost_amount },
      { header: "cost_currency", value: (record) => record.cost_currency },
      {
        header: "warranty_until_date",
        value: (record) => record.warranty_until_date,
      },
      {
        header: "warranty_until_odometer",
        value: (record) => record.warranty_until_odometer,
      },
      { header: "description", value: (record) => record.description },
      { header: "notes", value: (record) => record.notes },
      { header: "created_at", value: (record) => record.created_at },
      { header: "updated_at", value: (record) => record.updated_at },
    ],
    repairRecords,
  );
};

export const exportMaintenanceRemindersCsv = ({
  maintenanceReminders,
  vehicles,
}: {
  maintenanceReminders: MaintenanceReminder[];
  vehicles: Vehicle[];
}) => {
  const vehicleById = getVehicleLookup(vehicles);

  return buildCsv<MaintenanceReminder>(
    [
      { header: "reminder_id", value: (reminder) => reminder.id },
      { header: "vehicle_id", value: (reminder) => reminder.vehicle_id },
      {
        header: "vehicle_nickname",
        value: (reminder) =>
          getVehicleNickname(vehicleById, reminder.vehicle_id),
      },
      { header: "title", value: (reminder) => reminder.title },
      { header: "category", value: (reminder) => reminder.category },
      { header: "reminder_type", value: (reminder) => reminder.reminder_type },
      { header: "due_date", value: (reminder) => reminder.due_date },
      { header: "due_odometer", value: (reminder) => reminder.due_odometer },
      {
        header: "status",
        value: (reminder) =>
          getMaintenanceReminderStatus({
            currentOdometer:
              vehicleById.get(reminder.vehicle_id)?.current_odometer ?? 0,
            reminder,
          }),
      },
      {
        header: "is_completed",
        value: (reminder) => reminder.is_completed,
      },
      { header: "completed_at", value: (reminder) => reminder.completed_at },
      {
        header: "repeat_interval_months",
        value: (reminder) => reminder.repeat_interval_months,
      },
      {
        header: "repeat_interval_miles",
        value: (reminder) => reminder.repeat_interval_miles,
      },
      { header: "notes", value: (reminder) => reminder.notes },
      { header: "created_at", value: (reminder) => reminder.created_at },
      { header: "updated_at", value: (reminder) => reminder.updated_at },
    ],
    maintenanceReminders,
  );
};

export const exportRecordAttachmentsCsv = ({
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

  return buildCsv<RecordAttachment>(
    [
      { header: "attachment_id", value: (attachment) => attachment.id },
      { header: "vehicle_id", value: (attachment) => attachment.vehicle_id },
      {
        header: "vehicle_nickname",
        value: (attachment) =>
          getVehicleNickname(vehicleById, attachment.vehicle_id),
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
      { header: "local_uri", value: (attachment) => attachment.local_uri },
      { header: "created_at", value: (attachment) => attachment.created_at },
      { header: "updated_at", value: (attachment) => attachment.updated_at },
    ],
    recordAttachments,
  );
};

type CombinedCsvRow = Record<string, CsvCellValue>;

const combinedCsvColumns: Array<CsvColumn<CombinedCsvRow>> = [
  { header: "dataset", value: (row) => row.dataset },
  { header: "id", value: (row) => row.id },
  { header: "vehicle_id", value: (row) => row.vehicle_id },
  { header: "vehicle_nickname", value: (row) => row.vehicle_nickname },
  { header: "vehicle_archived", value: (row) => row.vehicle_archived },
  { header: "vehicle_year", value: (row) => row.vehicle_year },
  { header: "vehicle_make", value: (row) => row.vehicle_make },
  { header: "vehicle_model", value: (row) => row.vehicle_model },
  { header: "vehicle_trim", value: (row) => row.vehicle_trim },
  { header: "vehicle_type", value: (row) => row.vehicle_type },
  { header: "vin", value: (row) => row.vin },
  { header: "license_plate", value: (row) => row.license_plate },
  { header: "license_state", value: (row) => row.license_state },
  { header: "color", value: (row) => row.color },
  { header: "date", value: (row) => row.date },
  { header: "title", value: (row) => row.title },
  { header: "category", value: (row) => row.category },
  { header: "type", value: (row) => row.type },
  { header: "odometer", value: (row) => row.odometer },
  { header: "odometer_unit", value: (row) => row.odometer_unit },
  { header: "source_type", value: (row) => row.source_type },
  { header: "vendor_name", value: (row) => row.vendor_name },
  { header: "cost_amount", value: (row) => row.cost_amount },
  { header: "cost_currency", value: (row) => row.cost_currency },
  { header: "description", value: (row) => row.description },
  { header: "warranty_until_date", value: (row) => row.warranty_until_date },
  {
    header: "warranty_until_odometer",
    value: (row) => row.warranty_until_odometer,
  },
  { header: "due_date", value: (row) => row.due_date },
  { header: "due_odometer", value: (row) => row.due_odometer },
  { header: "status", value: (row) => row.status },
  { header: "is_completed", value: (row) => row.is_completed },
  { header: "completed_at", value: (row) => row.completed_at },
  {
    header: "repeat_interval_months",
    value: (row) => row.repeat_interval_months,
  },
  {
    header: "repeat_interval_miles",
    value: (row) => row.repeat_interval_miles,
  },
  { header: "linked_record_type", value: (row) => row.linked_record_type },
  { header: "linked_record_id", value: (row) => row.linked_record_id },
  { header: "linked_record_title", value: (row) => row.linked_record_title },
  { header: "file_name", value: (row) => row.file_name },
  { header: "file_type", value: (row) => row.file_type },
  { header: "mime_type", value: (row) => row.mime_type },
  { header: "file_size_bytes", value: (row) => row.file_size_bytes },
  { header: "local_uri", value: (row) => row.local_uri },
  { header: "notes", value: (row) => row.notes },
  { header: "created_at", value: (row) => row.created_at },
  { header: "updated_at", value: (row) => row.updated_at },
];

export type LocalCsvExportData = {
  maintenanceReminders: MaintenanceReminder[];
  odometerEntries: OdometerEntry[];
  recordAttachments: RecordAttachment[];
  repairRecords: RepairRecord[];
  serviceRecords: ServiceRecord[];
  vehicles: Vehicle[];
};

export const hasLocalCsvExportData = ({
  maintenanceReminders,
  odometerEntries,
  recordAttachments,
  repairRecords,
  serviceRecords,
  vehicles,
}: LocalCsvExportData) =>
  vehicles.length > 0 ||
  odometerEntries.length > 0 ||
  serviceRecords.length > 0 ||
  repairRecords.length > 0 ||
  maintenanceReminders.length > 0 ||
  recordAttachments.length > 0;

export const exportCombinedLocalCsv = (data: LocalCsvExportData) => {
  const vehicleById = getVehicleLookup(data.vehicles);
  const serviceRecordById = new Map(
    data.serviceRecords.map((record) => [record.id, record]),
  );
  const repairRecordById = new Map(
    data.repairRecords.map((record) => [record.id, record]),
  );
  const vehicleColumns = (vehicleId: string) => {
    const vehicle = vehicleById.get(vehicleId);

    return {
      vehicle_archived: Boolean(vehicle?.archived_at),
      vehicle_id: vehicleId,
      vehicle_make: vehicle?.make,
      vehicle_model: vehicle?.model,
      vehicle_nickname: vehicle?.nickname,
      vehicle_trim: vehicle?.trim,
      vehicle_type: vehicle?.vehicle_type,
      vehicle_year: vehicle?.year,
    };
  };
  const rows: CombinedCsvRow[] = [
    ...data.vehicles.map(
      (vehicle): CombinedCsvRow => ({
        color: vehicle.color,
        created_at: vehicle.created_at,
        dataset: "vehicles",
        date: vehicle.purchase_date,
        id: vehicle.id,
        license_plate: vehicle.license_plate,
        license_state: vehicle.license_state,
        notes: vehicle.notes,
        odometer: vehicle.current_odometer,
        odometer_unit: vehicle.odometer_unit,
        title: vehicle.nickname,
        updated_at: vehicle.updated_at,
        vehicle_archived: Boolean(vehicle.archived_at),
        vehicle_id: vehicle.id,
        vehicle_make: vehicle.make,
        vehicle_model: vehicle.model,
        vehicle_nickname: vehicle.nickname,
        vehicle_trim: vehicle.trim,
        vehicle_type: vehicle.vehicle_type,
        vehicle_year: vehicle.year,
        vin: vehicle.vin,
      }),
    ),
    ...data.odometerEntries.map(
      (entry): CombinedCsvRow => ({
        ...vehicleColumns(entry.vehicle_id),
        created_at: entry.created_at,
        dataset: "odometer_entries",
        date: entry.reading_date,
        id: entry.id,
        notes: entry.notes,
        odometer: entry.reading,
        odometer_unit: entry.odometer_unit,
        source_type: entry.source_type,
        title: "Odometer reading",
        updated_at: entry.updated_at,
      }),
    ),
    ...data.serviceRecords.map(
      (record): CombinedCsvRow => ({
        ...vehicleColumns(record.vehicle_id),
        category: record.category,
        cost_amount: record.cost_amount,
        cost_currency: record.cost_currency,
        created_at: record.created_at,
        dataset: "service_records",
        date: record.service_date,
        description: record.description,
        id: record.id,
        notes: record.notes,
        odometer: record.odometer_reading,
        title: record.title,
        updated_at: record.updated_at,
        vendor_name: record.vendor_name,
      }),
    ),
    ...data.repairRecords.map(
      (record): CombinedCsvRow => ({
        ...vehicleColumns(record.vehicle_id),
        category: record.category,
        cost_amount: record.cost_amount,
        cost_currency: record.cost_currency,
        created_at: record.created_at,
        dataset: "repair_records",
        date: record.repair_date,
        description: record.description,
        id: record.id,
        notes: record.notes,
        odometer: record.odometer_reading,
        title: record.title,
        updated_at: record.updated_at,
        vendor_name: record.vendor_name,
        warranty_until_date: record.warranty_until_date,
        warranty_until_odometer: record.warranty_until_odometer,
      }),
    ),
    ...data.maintenanceReminders.map(
      (reminder): CombinedCsvRow => ({
        ...vehicleColumns(reminder.vehicle_id),
        category: reminder.category,
        completed_at: reminder.completed_at,
        created_at: reminder.created_at,
        dataset: "maintenance_reminders",
        due_date: reminder.due_date,
        due_odometer: reminder.due_odometer,
        id: reminder.id,
        is_completed: reminder.is_completed,
        notes: reminder.notes,
        repeat_interval_miles: reminder.repeat_interval_miles,
        repeat_interval_months: reminder.repeat_interval_months,
        status: getMaintenanceReminderStatus({
          currentOdometer:
            vehicleById.get(reminder.vehicle_id)?.current_odometer ?? 0,
          reminder,
        }),
        title: reminder.title,
        type: reminder.reminder_type,
        updated_at: reminder.updated_at,
      }),
    ),
    ...data.recordAttachments.map((attachment): CombinedCsvRow => {
      const linkedRecordTitle = attachment.service_record_id
        ? serviceRecordById.get(attachment.service_record_id)?.title
        : attachment.repair_record_id
          ? repairRecordById.get(attachment.repair_record_id)?.title
          : "";

      return {
        ...vehicleColumns(attachment.vehicle_id),
        created_at: attachment.created_at,
        dataset: "record_attachments",
        file_name: attachment.file_name,
        file_size_bytes: attachment.file_size_bytes,
        file_type: attachment.file_type,
        id: attachment.id,
        linked_record_id:
          attachment.service_record_id ?? attachment.repair_record_id,
        linked_record_title: linkedRecordTitle,
        linked_record_type: attachment.service_record_id ? "service" : "repair",
        local_uri: attachment.local_uri,
        mime_type: attachment.mime_type,
        title: attachment.file_name,
        updated_at: attachment.updated_at,
      };
    }),
  ];

  return buildCsv(combinedCsvColumns, rows);
};

export const exportLocalCsvBundle = (data: LocalCsvExportData) => ({
  "autoledger-attachments.csv": exportRecordAttachmentsCsv({
    recordAttachments: data.recordAttachments,
    repairRecords: data.repairRecords,
    serviceRecords: data.serviceRecords,
    vehicles: data.vehicles,
  }),
  "autoledger-combined.csv": exportCombinedLocalCsv(data),
  "autoledger-odometer-entries.csv": exportOdometerEntriesCsv({
    odometerEntries: data.odometerEntries,
    vehicles: data.vehicles,
  }),
  "autoledger-reminders.csv": exportMaintenanceRemindersCsv({
    maintenanceReminders: data.maintenanceReminders,
    vehicles: data.vehicles,
  }),
  "autoledger-repair-records.csv": exportRepairRecordsCsv({
    repairRecords: data.repairRecords,
    vehicles: data.vehicles,
  }),
  "autoledger-service-records.csv": exportServiceRecordsCsv({
    serviceRecords: data.serviceRecords,
    vehicles: data.vehicles,
  }),
  "autoledger-vehicles.csv": exportVehiclesCsv(data.vehicles),
});
