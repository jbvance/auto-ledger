import { render, screen } from "@testing-library/react-native";

import { VehicleSummaryCard } from "./VehicleSummaryCard";

const vehicle = {
  archived_at: null,
  color: null,
  created_at: "2026-01-01T00:00:00.000Z",
  current_odometer: 25000,
  id: "veh_1",
  initial_odometer: 10000,
  license_plate: null,
  license_state: null,
  local_id: "veh_1",
  make: "Honda",
  model: "CR-V",
  nickname: "Family car",
  notes: null,
  odometer_unit: "mi",
  purchase_date: null,
  purchase_odometer: null,
  sync_status: "local_only",
  trim: "EX",
  updated_at: "2026-01-02T00:00:00.000Z",
  vehicle_type: "suv",
  vin: null,
  year: 2020,
} as const;

describe("VehicleSummaryCard", () => {
  it("renders basic vehicle information", () => {
    render(<VehicleSummaryCard vehicle={vehicle} />);

    expect(screen.getByText("Family car")).toBeTruthy();
    expect(screen.getByText("2020 Honda CR-V EX")).toBeTruthy();
    expect(screen.getByText("SUV")).toBeTruthy();
    expect(screen.getByText("25,000 mi")).toBeTruthy();
  });
});
