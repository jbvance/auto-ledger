import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CloudMaintenanceReminderRow, CloudVehicleRow } from "./mappers";
import {
  listWebCloudVehicles,
  loadWebCloudDashboardData,
  loadWebCloudVehicleDetail,
} from "./serverData";

type TableName =
  | "maintenance_reminders"
  | "odometer_entries"
  | "record_attachments"
  | "repair_records"
  | "service_records"
  | "vehicles";

type Filter =
  | {
      column: string;
      operation: "eq";
      value: unknown;
    }
  | {
      column: string;
      operation: "in";
      value: unknown[];
    }
  | {
      column: string;
      operation: "is";
      value: null;
    }
  | {
      column: string;
      operation: "not.is";
      value: null;
    };

type QueryResult = {
  count: null | number;
  data: unknown[] | unknown | null;
  error: null;
};

type MockRows = Record<TableName, Array<Record<string, unknown>>>;

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rows: {
    maintenance_reminders: [],
    odometer_entries: [],
    record_attachments: [],
    repair_records: [],
    service_records: [],
    vehicles: [],
  } as MockRows,
}));

vi.mock("../supabase/config", () => ({
  getWebSupabaseConfig: () => ({
    anonKey: "anon-key",
    isConfigured: true,
    url: "https://example.supabase.co",
  }),
}));

vi.mock("../supabase/server", () => ({
  createClient: mocks.createClient,
}));

class MockSupabaseQuery {
  private countMode = false;
  private filters: Filter[] = [];
  private limitCount: null | number = null;

  constructor(private readonly table: TableName) {}

  select(_columns: string, options?: { count?: string; head?: boolean }) {
    this.countMode = options?.count === "exact" || options?.head === true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operation: "eq", value });
    return this;
  }

  filter(column: string, operation: string, value: string) {
    if (operation === "not.is" && value === "null") {
      this.filters.push({ column, operation: "not.is", value: null });
    }

    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, operation: "in", value });
    return this;
  }

  is(column: string, value: null) {
    this.filters.push({ column, operation: "is", value });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    return Promise.resolve({
      count: null,
      data: this.getRows()[0] ?? null,
      error: null,
    });
  }

  order() {
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ) {
    return Promise.resolve(this.getResult()).then(onfulfilled, onrejected);
  }

  private getResult(): QueryResult {
    const rows = this.getRows();

    if (this.countMode) {
      return {
        count: rows.length,
        data: null,
        error: null,
      };
    }

    return {
      count: null,
      data: rows,
      error: null,
    };
  }

  private getRows() {
    const rows = mocks.rows[this.table].filter((row) =>
      this.filters.every((filter) => {
        const value = row[filter.column];

        if (filter.operation === "eq") {
          return value === filter.value;
        }

        if (filter.operation === "in") {
          return filter.value.includes(value);
        }

        if (filter.operation === "is") {
          return value === null || value === undefined;
        }

        return value !== null && value !== undefined;
      }),
    );

    return this.limitCount === null ? rows : rows.slice(0, this.limitCount);
  }
}

const createMockSupabaseClient = () => ({
  from: (table: TableName) => new MockSupabaseQuery(table),
});

const createVehicleRow = (
  overrides: Partial<CloudVehicleRow> = {},
): CloudVehicleRow => ({
  archived_at: null,
  color: null,
  created_at: "2026-01-01T00:00:00.000Z",
  current_odometer: 42000,
  id: "vehicle-1",
  initial_odometer: 40000,
  license_plate: null,
  license_state: null,
  local_id: "cloud_vehicle_1",
  make: "Toyota",
  model: "RAV4",
  nickname: "Family SUV",
  notes: null,
  odometer_unit: "mi",
  purchase_date: null,
  purchase_odometer: null,
  sync_status: "synced",
  trim: null,
  user_id: "user-1",
  vehicle_type: "suv",
  vin: null,
  year: 2020,
  updated_at: "2026-01-02T00:00:00.000Z",
  ...overrides,
});

const createMaintenanceReminderRow = (
  overrides: Partial<CloudMaintenanceReminderRow> = {},
): CloudMaintenanceReminderRow => ({
  category: "oil_change",
  completed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  due_date: "2026-12-01",
  due_odometer: null,
  id: "reminder-1",
  is_completed: false,
  last_triggered_at: null,
  local_id: "cloud_reminder_1",
  notes: null,
  reminder_type: "date",
  repeat_interval_miles: null,
  repeat_interval_months: null,
  scheduled_notification_id: null,
  sync_status: "synced",
  title: "Oil change",
  updated_at: "2026-01-02T00:00:00.000Z",
  user_id: "user-1",
  vehicle_id: "vehicle-1",
  ...overrides,
});

describe("web cloud server data", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(createMockSupabaseClient());
    mocks.rows.maintenance_reminders = [];
    mocks.rows.odometer_entries = [];
    mocks.rows.record_attachments = [];
    mocks.rows.repair_records = [];
    mocks.rows.service_records = [];
    mocks.rows.vehicles = [];
  });

  it("builds an empty dashboard state for a signed-in account with no cloud rows", async () => {
    const dashboard = await loadWebCloudDashboardData("user-1");

    expect(dashboard.activeVehicles).toEqual([]);
    expect(dashboard.activeReminders).toEqual([]);
    expect(dashboard.recentActivity).toEqual([]);
    expect(dashboard.archivedVehicleCount).toBe(0);
    expect(dashboard.counts).toEqual({
      activeVehicles: 0,
      odometerEntries: 0,
      repairRecords: 0,
      serviceRecords: 0,
      upcomingReminders: 0,
    });
  });

  it("lists signed-in user's cloud vehicles including archived status", async () => {
    mocks.rows.vehicles = [
      createVehicleRow(),
      createVehicleRow({
        archived_at: "2026-01-03T00:00:00.000Z",
        id: "vehicle-2",
        local_id: "cloud_vehicle_2",
        nickname: "Old Truck",
        vehicle_type: "truck",
      }),
      createVehicleRow({
        id: "other-user-vehicle",
        local_id: "other-user-vehicle",
        user_id: "user-2",
      }),
    ];

    const vehicles = await listWebCloudVehicles({
      includeArchived: true,
      userId: "user-1",
    });

    expect(vehicles).toHaveLength(2);
    expect(vehicles.map((vehicle) => vehicle.nickname)).toEqual([
      "Family SUV",
      "Old Truck",
    ]);
    expect(vehicles[1]?.archived_at).toBe("2026-01-03T00:00:00.000Z");
  });

  it("sorts dashboard reminders by calculated urgency before trimming", async () => {
    mocks.rows.vehicles = [createVehicleRow({ current_odometer: 42000 })];
    mocks.rows.maintenance_reminders = [
      ...Array.from({ length: 6 }, (_, index) =>
        createMaintenanceReminderRow({
          due_date: `2026-12-${String(index + 1).padStart(2, "0")}`,
          id: `future-reminder-${index + 1}`,
          local_id: `future_reminder_${index + 1}`,
          title: `Future reminder ${index + 1}`,
        }),
      ),
      createMaintenanceReminderRow({
        due_date: null,
        due_odometer: 41000,
        id: "overdue-mileage-reminder",
        local_id: "overdue_mileage_reminder",
        reminder_type: "mileage",
        title: "Mileage overdue",
      }),
    ];

    const dashboard = await loadWebCloudDashboardData("user-1");

    expect(dashboard.counts.upcomingReminders).toBe(7);
    expect(dashboard.activeReminders).toHaveLength(6);
    expect(dashboard.activeReminders[0]?.id).toBe("overdue-mileage-reminder");
    expect(dashboard.activeReminders.map((reminder) => reminder.id)).not.toContain(
      "future-reminder-6",
    );
  });

  it("sorts vehicle detail reminders by calculated urgency", async () => {
    mocks.rows.vehicles = [createVehicleRow({ current_odometer: 42000 })];
    mocks.rows.maintenance_reminders = [
      createMaintenanceReminderRow({
        due_date: "2026-12-01",
        id: "future-reminder",
        local_id: "future_reminder",
        title: "Future reminder",
      }),
      createMaintenanceReminderRow({
        due_date: null,
        due_odometer: 41000,
        id: "overdue-mileage-reminder",
        local_id: "overdue_mileage_reminder",
        reminder_type: "mileage",
        title: "Mileage overdue",
      }),
    ];

    const detail = await loadWebCloudVehicleDetail({
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(detail?.maintenanceReminders.map((reminder) => reminder.id)).toEqual(
      ["overdue-mileage-reminder", "future-reminder"],
    );
  });

  it("returns null for a missing or not-owned vehicle detail", async () => {
    mocks.rows.vehicles = [
      createVehicleRow({
        id: "other-user-vehicle",
        local_id: "other-user-vehicle",
        user_id: "user-2",
      }),
    ];

    const detail = await loadWebCloudVehicleDetail({
      userId: "user-1",
      vehicleId: "other-user-vehicle",
    });

    expect(detail).toBeNull();
  });
});
