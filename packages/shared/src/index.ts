export const appName = "AutoLedger";

export const currentPhase = {
  id: 2,
  name: "Guest Mode Core Records",
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
      "odometer_reading" | "description" | "cost_amount" | "notes"
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
      | "cost_amount"
      | "warranty_until_date"
      | "warranty_until_odometer"
      | "notes"
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

export const foundationNavigation: NavigationSection[] = [
  {
    label: "Dashboard",
    description: "The future home for vehicle summaries and reminders.",
  },
  {
    label: "Vehicles",
    description: "Guest vehicle tracking starts locally on this device.",
  },
  {
    label: "Records",
    description: "Service and repair records are intentionally not active yet.",
  },
  {
    label: "Settings",
    description: "Privacy, sync, and export controls come in later phases.",
  },
];
