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
