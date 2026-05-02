import { act, render, screen } from "@testing-library/react-native";

import HomeScreen from "../app/(tabs)/index";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual("react");

    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock("../lib/auth", () => ({
  useAuth: () => ({
    isLoading: false,
    user: null,
  }),
}));

jest.mock("../lib/vehicles", () => ({
  listArchivedVehicles: jest.fn(async () => []),
  listVehicles: jest.fn(async () => []),
}));

jest.mock("../lib/maintenanceReminders", () => ({
  listAllActiveMaintenanceReminders: jest.fn(async () => []),
}));

jest.mock("../lib/odometerEntries", () => ({
  listOdometerEntries: jest.fn(async () => []),
}));

jest.mock("../lib/serviceRecords", () => ({
  listServiceRecords: jest.fn(async () => []),
}));

jest.mock("../lib/repairRecords", () => ({
  listRepairRecords: jest.fn(async () => []),
}));

jest.mock("../lib/localGuestData", () => ({
  hasAnyLocalGuestData: jest.fn(async () => false),
}));

jest.mock("../lib/cloudVehicles", () => ({
  listArchivedCloudVehicles: jest.fn(async () => []),
  listCloudVehicles: jest.fn(async () => []),
}));

jest.mock("../lib/cloudMaintenanceReminders", () => ({
  listAllActiveCloudMaintenanceReminders: jest.fn(async () => []),
}));

jest.mock("../lib/cloudOdometerEntries", () => ({
  listCloudOdometerEntries: jest.fn(async () => []),
}));

jest.mock("../lib/cloudServiceRecords", () => ({
  listCloudServiceRecords: jest.fn(async () => []),
}));

jest.mock("../lib/cloudRepairRecords", () => ({
  listCloudRepairRecords: jest.fn(async () => []),
}));

describe("HomeScreen", () => {
  it("renders the guest empty state when no vehicles exist", async () => {
    render(<HomeScreen />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Start your local garage")).toBeTruthy();
    expect(screen.getByText("Add Your First Vehicle")).toBeTruthy();
  });
});
