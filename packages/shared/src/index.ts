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
