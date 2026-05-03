import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CloudMaintenanceReminderRow,
  CloudVehicleRow,
} from "./mappers";
import {
  completeWebCloudMaintenanceReminder,
  createWebCloudMaintenanceReminder,
  deleteWebCloudMaintenanceReminder,
  toWebCloudMaintenanceReminderCreatePayload,
  updateWebCloudMaintenanceReminder,
} from "./maintenanceReminderMutations";

type TableName = "maintenance_reminders" | "vehicles";

type Filter =
  | {
      column: string;
      operation: "eq";
      value: unknown;
    }
  | {
      column: string;
      operation: "is";
      value: null;
    };

type Mutation = {
  payload?: Record<string, unknown>;
  type: "delete" | "insert" | "update";
} | null;

type QueryResult = {
  data: null | Record<string, unknown> | Array<Record<string, unknown>>;
  error: null;
};

type MockRows = Record<TableName, Array<Record<string, unknown>>>;

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rows: {
    maintenance_reminders: [],
    vehicles: [],
  } as MockRows,
}));

vi.mock("../supabase/server", () => ({
  createClient: mocks.createClient,
}));

class MockSupabaseQuery {
  private filters: Filter[] = [];
  private mutation: Mutation = null;

  constructor(private readonly table: TableName) {}

  delete() {
    this.mutation = { type: "delete" };
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operation: "eq", value });
    return this;
  }

  insert(payload: Record<string, unknown>) {
    this.mutation = { payload, type: "insert" };
    return this;
  }

  is(column: string, value: null) {
    this.filters.push({ column, operation: "is", value });
    return this;
  }

  maybeSingle() {
    if (this.mutation) {
      return Promise.resolve(this.applyMutation());
    }

    return Promise.resolve({
      data: this.getRows()[0] ?? null,
      error: null,
    });
  }

  select() {
    return this;
  }

  single() {
    return Promise.resolve(this.applyMutation());
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.applyMutation()).then(onfulfilled, onrejected);
  }

  update(payload: Record<string, unknown>) {
    this.mutation = { payload, type: "update" };
    return this;
  }

  private applyMutation(): QueryResult {
    if (this.mutation?.type === "insert") {
      const row = {
        created_at: "2026-01-03T00:00:00.000Z",
        id: `rem-${mocks.rows[this.table].length + 1}`,
        updated_at: "2026-01-03T00:00:00.000Z",
        ...this.mutation.payload,
      };

      mocks.rows[this.table].push(row);

      return { data: row, error: null };
    }

    if (this.mutation?.type === "update") {
      const rows = this.getRows();

      rows.forEach((row) => {
        Object.assign(row, this.mutation?.payload, {
          updated_at: "2026-01-04T00:00:00.000Z",
        });
      });

      return { data: rows[0] ?? null, error: null };
    }

    if (this.mutation?.type === "delete") {
      const rowsToDelete = new Set(this.getRows());

      mocks.rows[this.table] = mocks.rows[this.table].filter(
        (row) => !rowsToDelete.has(row),
      );

      return { data: null, error: null };
    }

    return { data: this.getRows(), error: null };
  }

  private getRows() {
    return mocks.rows[this.table].filter((row) =>
      this.filters.every((filter) => {
        const value = row[filter.column];

        if (filter.operation === "eq") {
          return value === filter.value;
        }

        return value === null || value === undefined;
      }),
    );
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

const createReminderRow = (
  overrides: Partial<CloudMaintenanceReminderRow> = {},
): CloudMaintenanceReminderRow => ({
  category: "oil_change",
  completed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  due_date: "2026-05-01",
  due_odometer: 45000,
  id: "rem-1",
  is_completed: false,
  last_triggered_at: null,
  local_id: "cloud_rem_1",
  notes: null,
  reminder_type: "date_or_mileage",
  repeat_interval_miles: 5000,
  repeat_interval_months: 6,
  scheduled_notification_id: null,
  sync_status: "synced",
  title: "Oil change",
  updated_at: "2026-01-02T00:00:00.000Z",
  user_id: "user-1",
  vehicle_id: "vehicle-1",
  ...overrides,
});

describe("web cloud maintenance reminder mutations", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(createMockSupabaseClient());
    mocks.rows.maintenance_reminders = [];
    mocks.rows.vehicles = [createVehicleRow()];
  });

  it("maps create payloads and clears irrelevant due fields by reminder type", () => {
    expect(
      toWebCloudMaintenanceReminderCreatePayload({
        input: {
          category: "registration",
          due_date: "2026-05-01",
          due_odometer: 45000,
          notes: "Renew online",
          reminder_type: "date",
          repeat_interval_months: 12,
          title: "Registration",
          vehicle_id: "vehicle-1",
        },
        localId: "web_rem_1",
        userId: "user-1",
      }),
    ).toMatchObject({
      completed_at: null,
      due_date: "2026-05-01",
      due_odometer: null,
      is_completed: false,
      local_id: "web_rem_1",
      scheduled_notification_id: null,
      sync_status: "synced",
      user_id: "user-1",
    });
  });

  it("creates a mileage reminder for an active owned vehicle", async () => {
    const reminder = await createWebCloudMaintenanceReminder({
      input: {
        category: "oil_change",
        due_date: "",
        due_odometer: "45000",
        notes: "",
        reminder_type: "mileage",
        repeat_interval_miles: "5000",
        repeat_interval_months: "",
        title: "Oil change",
        vehicle_id: "vehicle-1",
      },
      userId: "user-1",
    });

    expect(reminder.due_date).toBeNull();
    expect(reminder.due_odometer).toBe(45000);
    expect(mocks.rows.maintenance_reminders).toHaveLength(1);
  });

  it("rejects reminder-type validation errors before writing", async () => {
    await expect(
      createWebCloudMaintenanceReminder({
        input: {
          category: "registration",
          due_date: "",
          due_odometer: "",
          notes: "",
          reminder_type: "date",
          repeat_interval_miles: "",
          repeat_interval_months: "",
          title: "Registration",
          vehicle_id: "vehicle-1",
        },
        userId: "user-1",
      }),
    ).rejects.toThrow("Due date is required for date reminders.");

    expect(mocks.rows.maintenance_reminders).toHaveLength(0);
  });

  it("updates only an owned reminder for the routed vehicle", async () => {
    mocks.rows.maintenance_reminders = [createReminderRow()];

    const updated = await updateWebCloudMaintenanceReminder({
      input: {
        category: "battery",
        due_date: "2026-06-01",
        due_odometer: "",
        notes: "Check terminals",
        reminder_type: "date",
        repeat_interval_miles: "",
        repeat_interval_months: "12",
        title: "Battery check",
        vehicle_id: "vehicle-1",
      },
      reminderId: "rem-1",
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(updated?.title).toBe("Battery check");
    expect(updated?.due_odometer).toBeNull();
    expect(updated?.repeat_interval_months).toBe(12);
  });

  it("marks a cloud reminder complete without deleting it", async () => {
    mocks.rows.maintenance_reminders = [createReminderRow()];

    const completed = await completeWebCloudMaintenanceReminder({
      reminderId: "rem-1",
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(completed).toBe(true);
    expect(mocks.rows.maintenance_reminders).toHaveLength(1);
    expect(mocks.rows.maintenance_reminders[0]?.is_completed).toBe(true);
    expect(mocks.rows.maintenance_reminders[0]?.completed_at).toEqual(
      expect.any(String),
    );
  });

  it("deletes only the selected cloud reminder", async () => {
    mocks.rows.maintenance_reminders = [
      createReminderRow({ id: "rem-1" }),
      createReminderRow({
        id: "rem-2",
        local_id: "cloud_rem_2",
        title: "Tire rotation",
      }),
    ];

    const deleted = await deleteWebCloudMaintenanceReminder({
      reminderId: "rem-1",
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(deleted).toBe(true);
    expect(mocks.rows.maintenance_reminders.map((row) => row.id)).toEqual([
      "rem-2",
    ]);
  });
});
