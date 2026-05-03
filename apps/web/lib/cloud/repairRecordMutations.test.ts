import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CloudOdometerEntryRow,
  CloudRepairRecordRow,
  CloudServiceRecordRow,
  CloudVehicleRow,
} from "./mappers";
import {
  createWebCloudRepairRecord,
  deleteWebCloudRepairRecord,
  toWebCloudRepairRecordCreatePayload,
  updateWebCloudRepairRecord,
} from "./repairRecordMutations";

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
        id: `rep-${mocks.rows[this.table].length + 1}`,
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

const createRepairRecordRow = (
  overrides: Partial<CloudRepairRecordRow> = {},
): CloudRepairRecordRow => ({
  category: "brakes",
  cost_amount: null,
  cost_currency: "USD",
  created_at: "2026-01-01T00:00:00.000Z",
  description: null,
  id: "rep-1",
  local_id: "cloud_rep_1",
  notes: null,
  odometer_reading: 43000,
  repair_date: "2026-01-01",
  sync_status: "synced",
  title: "Brake repair",
  updated_at: "2026-01-01T00:00:00.000Z",
  user_id: "user-1",
  vehicle_id: "vehicle-1",
  vendor_id: null,
  vendor_name: null,
  warranty_until_date: null,
  warranty_until_odometer: null,
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
  odometer_reading: 42000,
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

describe("web cloud repair record mutations", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(createMockSupabaseClient());
    mocks.rows.odometer_entries = [];
    mocks.rows.repair_records = [];
    mocks.rows.service_records = [];
    mocks.rows.vehicles = [createVehicleRow()];
  });

  it("maps create payloads for Supabase repair records including warranty fields", () => {
    expect(
      toWebCloudRepairRecordCreatePayload({
        input: {
          category: "electrical",
          cost_amount: 310.75,
          cost_currency: "USD",
          description: "Replaced alternator",
          notes: "Keep warranty invoice",
          odometer_reading: 43000,
          repair_date: "2026-01-02",
          title: "Alternator replacement",
          vehicle_id: "vehicle-1",
          vendor_name: "Local Shop",
          warranty_until_date: "2027-01-02",
          warranty_until_odometer: 55000,
        },
        localId: "web_rep_1",
        userId: "user-1",
      }),
    ).toEqual({
      category: "electrical",
      cost_amount: 310.75,
      cost_currency: "USD",
      description: "Replaced alternator",
      local_id: "web_rep_1",
      notes: "Keep warranty invoice",
      odometer_reading: 43000,
      repair_date: "2026-01-02",
      sync_status: "synced",
      title: "Alternator replacement",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
      vendor_id: null,
      vendor_name: "Local Shop",
      warranty_until_date: "2027-01-02",
      warranty_until_odometer: 55000,
    });
  });

  it("creates a cloud repair record and updates vehicle current odometer", async () => {
    const record = await createWebCloudRepairRecord({
      input: {
        category: "brakes",
        cost_amount: "",
        cost_currency: "USD",
        description: "",
        notes: "",
        odometer_reading: "43500",
        repair_date: "2026-01-02",
        title: "Brake repair",
        vehicle_id: "vehicle-1",
        vendor_name: "",
        warranty_until_date: "",
        warranty_until_odometer: "",
      },
      userId: "user-1",
    });

    expect(record.odometer_reading).toBe(43500);
    expect(mocks.rows.repair_records).toHaveLength(1);
    expect(mocks.rows.vehicles[0]?.current_odometer).toBe(43500);
  });

  it("rejects validation errors before writing", async () => {
    await expect(
      createWebCloudRepairRecord({
        input: {
          category: "brakes",
          cost_amount: "",
          cost_currency: "USD",
          description: "",
          notes: "",
          odometer_reading: "",
          repair_date: "2026-01-02",
          title: "",
          vehicle_id: "vehicle-1",
          vendor_name: "",
          warranty_until_date: "",
          warranty_until_odometer: "",
        },
        userId: "user-1",
      }),
    ).rejects.toThrow("Title is required.");

    expect(mocks.rows.repair_records).toHaveLength(0);
  });

  it("updates only an owned repair record for the routed vehicle and recalculates odometer", async () => {
    mocks.rows.repair_records = [createRepairRecordRow()];

    const updated = await updateWebCloudRepairRecord({
      input: {
        category: "electrical",
        cost_amount: "310.75",
        cost_currency: "USD",
        description: "Replaced alternator",
        notes: "Warranty starts today",
        odometer_reading: "44000",
        repair_date: "2026-01-03",
        title: "Alternator replacement",
        vehicle_id: "vehicle-1",
        vendor_name: "Parts Store",
        warranty_until_date: "2027-01-03",
        warranty_until_odometer: "56000",
      },
      repairRecordId: "rep-1",
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(updated?.title).toBe("Alternator replacement");
    expect(updated?.cost_amount).toBe(310.75);
    expect(updated?.vendor_name).toBe("Parts Store");
    expect(updated?.warranty_until_odometer).toBe(56000);
    expect(mocks.rows.vehicles[0]?.current_odometer).toBe(44000);
  });

  it("deletes one cloud repair record and recalculates from remaining cloud rows", async () => {
    mocks.rows.vehicles = [createVehicleRow({ current_odometer: 44000 })];
    mocks.rows.odometer_entries = [createOdometerEntryRow({ reading: 41000 })];
    mocks.rows.service_records = [
      createServiceRecordRow({ odometer_reading: 42000 }),
    ];
    mocks.rows.repair_records = [
      createRepairRecordRow({ id: "rep-1", odometer_reading: 44000 }),
      createRepairRecordRow({
        id: "rep-2",
        local_id: "cloud_rep_2",
        odometer_reading: 43000,
      }),
    ];

    const deleted = await deleteWebCloudRepairRecord({
      repairRecordId: "rep-1",
      userId: "user-1",
      vehicleId: "vehicle-1",
    });

    expect(deleted).toBe(true);
    expect(mocks.rows.repair_records.map((row) => row.id)).toEqual(["rep-2"]);
    expect(mocks.rows.vehicles[0]?.current_odometer).toBe(43000);
  });
});
