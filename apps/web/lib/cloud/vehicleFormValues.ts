import type { Vehicle } from "@autoledger/shared";

export type WebVehicleFormValues = {
  color: string;
  current_odometer: string;
  license_plate: string;
  license_state: string;
  make: string;
  model: string;
  nickname: string;
  notes: string;
  odometer_unit: Vehicle["odometer_unit"];
  purchase_date: string;
  purchase_odometer: string;
  trim: string;
  vehicle_type: Vehicle["vehicle_type"];
  vin: string;
  year: string;
};

export const emptyWebVehicleFormValues: WebVehicleFormValues = {
  color: "",
  current_odometer: "",
  license_plate: "",
  license_state: "",
  make: "",
  model: "",
  nickname: "",
  notes: "",
  odometer_unit: "mi",
  purchase_date: "",
  purchase_odometer: "",
  trim: "",
  vehicle_type: "car",
  vin: "",
  year: "",
};

const fieldValue = (value: null | number | string | undefined) =>
  value === null || value === undefined ? "" : `${value}`;

export const vehicleToWebVehicleFormValues = (
  vehicle: Vehicle,
): WebVehicleFormValues => ({
  color: fieldValue(vehicle.color),
  current_odometer: `${vehicle.current_odometer}`,
  license_plate: fieldValue(vehicle.license_plate),
  license_state: fieldValue(vehicle.license_state),
  make: vehicle.make,
  model: vehicle.model,
  nickname: vehicle.nickname,
  notes: fieldValue(vehicle.notes),
  odometer_unit: vehicle.odometer_unit,
  purchase_date: fieldValue(vehicle.purchase_date),
  purchase_odometer: fieldValue(vehicle.purchase_odometer),
  trim: fieldValue(vehicle.trim),
  vehicle_type: vehicle.vehicle_type,
  vin: fieldValue(vehicle.vin),
  year: `${vehicle.year}`,
});
