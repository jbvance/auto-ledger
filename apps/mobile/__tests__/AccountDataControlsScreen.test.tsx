import { act, render, screen } from "@testing-library/react-native";

import AccountDataControlsScreen from "../app/settings/data";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual("react");

    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock("../lib/auth", () => ({
  useAuth: () => ({
    isConfigured: true,
    isLoading: false,
    user: null,
  }),
}));

jest.mock("../lib/localDataControls", () => ({
  deleteAllLocalGuestData: jest.fn(),
  getLocalGuestDataControlSummary: jest.fn(async () => ({
    hasLocalGuestData: true,
    migrationSummary: {
      accountId: null,
      counts: {
        activeVehicles: 1,
        archivedVehicles: 0,
        attachments: 1,
        completedReminders: 0,
        maintenanceReminders: 1,
        odometerEntries: 1,
        repairRecords: 1,
        serviceRecords: 1,
        totalRecords: 6,
        totalVehicles: 1,
      },
      hasGuestData: true,
      warnings: [],
    },
  })),
  localGuestDataDeleteConfirmationPhrase: "DELETE LOCAL DATA",
}));

describe("mobile account data controls screen", () => {
  it("renders data location copy, local export access, and confirmation copy", async () => {
    render(<AccountDataControlsScreen />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText(/Local guest records are stored on this device/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Cloud account records are stored in your AutoLedger/),
    ).toBeTruthy();
    expect(screen.getByText("Export Local CSV")).toBeTruthy();
    expect(screen.getByPlaceholderText("DELETE LOCAL DATA")).toBeTruthy();
    expect(screen.getByText("Delete Local Guest Data")).toBeTruthy();
    expect(
      screen.getByText(/This affects only records stored on this device/),
    ).toBeTruthy();
  });
});
