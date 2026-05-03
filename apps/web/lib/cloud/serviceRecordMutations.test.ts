import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CloudOdometerEntryRow,
  CloudServiceRecordRow,
  CloudVehicleRow,
} from "./mappers";
import {
  createWebCloudServiceRecord,
  deleteWebCloudServiceRecord,
  toWebCloudServiceRecordCreatePayload,
  updateWebCloudServiceRecord,
} from "./serviceRecordMutations";

type TableName =
  | "odometer_entries"
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
      operation: "is";
      value: null;
    }
  | {
      column: string;
      operation: "not.is";
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
    odometer_entries: [],
    repair_records: [],
    service_records: [],
    vehicles: [],
  } as MockRows,
}));

vi.mock("../supabase/server", () => ({
  createClient: mocks.createClient,
}));

class MockSupabaseQuery {
  private filters: Filter[] = [];
  private limitCount: null | number = null;
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

  filter(column: string, operation: string, value: string) {
    if (operation === "not.is" && value === "null") {
      this.filters.push({ column, operation: "not.is", value: null });
    }

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

  limit(count: number) {
    this.limitCount = count;
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

  order(column: string, options: { ascending: boolean }) {
    mocks.rows[this.table].sort((first, second) => {
      const firstValue = Number(first[column] ?? 0);
      const secondValue = Number(second[column] ?? 0);

      return options.ascending
        ? firstValue - secondValue
        : secondValue - firstValue;
    });

    return this;
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
        id: `svc-${mocks.rows[this.table].length + 1}`,
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
    const rows = mocks.rows[this.table].filter((row) =>
      this.filters.every((filter) => {
        const value = row[filter.column];

        if (filter.operation === "eq") {
          return value === filter.value;
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

const createServiceRecordRow = (
  overrides: Partial<CloudServiceRecordRow> = {},
): CloudServiceRecordRow => ({
  category: "oil_change",
  cost_amount: null,
  cost_currency: "USD",
  created_at: "2026-01-01T00:00:00.000Z",
  description: null,
  id: "svc-1",
  local_id: "cloud_svc_1",
  notes: null,
  odometer_reading: 43000,
  service_date: "2026-01-01",
  sync_status: "synced",
  title: "Oil change",
  updated_at: "2026-01-01T00:00:00.000Z",
  user_id: "user-1",
  vehicle_id: "vehicle-1",
  vendor_id: null,
  vendor_name: null,
  ...overrides,
});

const createOdometerEntryRow = (
  overrides: Partial<CloudOdometerEntryRow> = {},
): CloudOdometerEntryRow => ({
  created_at: "2026-01-01T00:00:00.000Z",
  id: "odo-1",
  local_id: "cloud_odo_1",
  notes: null,
  odometer_unit: "mi",
  reading: 41000,
  reading_date: "2026-01-01",
  source_type: "manual",
  sync_status: "synced",
  updated_at: "2026-01-01T00:00:00.000Z",
  user_id: "user-1",
  vehicle_id: "vehicle-1",
  ...overrides,
});

describe("web cloud service record mutations", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(createMockSupabaseClient());
    mocks.rows.odometer_entries = [];
    mocks.rows.repair_records = [];
    mocks.rows.service_records = [];
    mocks.rows.vehicles = [createVehicleRow()];
  });

  it("maps create payloads for Supabase service records", () => {
    expect(
      toWebCloudServiceRecordCreatePayload({
        input: {
          category: "oil_change",
          cost_amount: 89.95,
          cost_currency: "USD",
          description: "Synthetic oil and filter",
          notes: "Used coupon",
          odometer_reading: 43000,
          service_date: "2026-01-02",
          title: "Oil change",
          vehicle_id: "vehicle-1",
          vendor_name: "Local Shop",
        },
        localId: "web_svc_1",
        userId: "user-1",
      }),
    ).toEqual({
      category: "oil_change",
      cost_amount: 89.95,
      cost_currency: "USD",
      description: "Synthetic oil and filter",
      local_id: "web_svc_1",
      notes: "Used coupon",
      odometer_reading: 43000,
      service_date: "2026-01-02",
      sync_status: "synced",
      title: "Oil change",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
      vendor_id: null,
      vendor_name: "Local Shop",
    });
  });

  it("creates a cloud service record and updates vehicle current odometer", async () => {
    const record = await createWebCloudServiceRecord({
      input: {
        category: "oil_change",
        cost_amount: "",
        cost_currency: "USD",
        description: "",
        notes: "",
        odometer_reading: "43500",
        service_date: "2026-01-02",
        title: "Oil change",
        vehicle_id: "vehicle-1",
        vendor_name: "",
      },
      userId: "user-1",
    });

    expect(record.odometer_reading).toBe(43500);
    expect(mocks.rows.service_records).toHaveLength(1);
    expect(mocks.rows.vehicles[0]?.current_odometer).toBe(43500);
  });

  it("rejects validation errors before writing", async () => {
    await expect(
      createWebCloudServiceRecord({
        input: {
          category: "oil_change",
          cost_amount: "",
          cost_currency: "USD",
          description: "",
          notes: "",
          odometer_reading: "",
          service_date: "2026-01-02",
          title: "",
          vehicle_id: "vehicle-1",
          vendor_name: "",
        },
        userId: "user-1",
      }),
    ).rejects.toThrow("Title is required.");

    expect(mocks.rows.service_records).toHaveLength(0);
  });

  it("updates only an owned record for the routed vehicle and recalculates odometer", async () => {
    mocks.rows.service_records = [createServiceRecordRow()];

    const updated = await updateWebCloudServiceRecord({
      input: {
        category: "battery",
        cost_amount: "210.5",
        cost_currency: "USD",
        description: "Battery replacement",
        notes: "Warranty starts today",
        odometer_reading: "44000",
        service_date: "2026-01-03",
        title: "Battery replacement",
        vehicle_id: "vehicle-1",
        vendor_name: "Parts Store",
      },
      serviceRecordId: "svc-1",
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(updated?.title).toBe("Battery replacement");
    expect(updated?.cost_amount).toBe(210.5);
    expect(updated?.vendor_name).toBe("Parts Store");
    expect(mocks.rows.vehicles[0]?.current_odometer).toBe(44000);
  });

  it("deletes one cloud service record and recalculates from remaining cloud rows", async () => {
    mocks.rows.vehicles = [createVehicleRow({ current_odometer: 44000 })];
    mocks.rows.odometer_entries = [createOdometerEntryRow({ reading: 41000 })];
    mocks.rows.service_records = [
      createServiceRecordRow({ id: "svc-1", odometer_reading: 44000 }),
      createServiceRecordRow({
        id: "svc-2",
        local_id: "cloud_svc_2",
        odometer_reading: 42000,
      }),
    ];

    const deleted = await deleteWebCloudServiceRecord({
      serviceRecordId: "svc-1",
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(deleted).toBe(true);
    expect(mocks.rows.service_records.map((row) => row.id)).toEqual(["svc-2"]);
    expect(mocks.rows.vehicles[0]?.current_odometer).toBe(42000);
  });
});
