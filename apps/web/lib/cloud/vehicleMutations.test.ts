import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CloudVehicleRow } from "./mappers";
import {
  archiveWebCloudVehicle,
  createWebCloudVehicle,
  restoreWebCloudVehicle,
  toWebCloudVehicleCreatePayload,
  toWebCloudVehicleUpdatePayload,
  updateWebCloudVehicle,
} from "./vehicleMutations";

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

type Mutation =
  | {
      payload: Record<string, unknown>;
      type: "insert" | "update";
    }
  | null;

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rows: [] as CloudVehicleRow[],
  updatePayloads: [] as Array<Record<string, unknown>>,
}));

vi.mock("../supabase/server", () => ({
  createClient: mocks.createClient,
}));

const createVehicleInput = (overrides: Record<string, unknown> = {}) => ({
  color: "",
  current_odometer: "42000",
  license_plate: "",
  license_state: "",
  make: "Toyota",
  model: "RAV4",
  nickname: "Family SUV",
  notes: "",
  odometer_unit: "mi",
  purchase_date: "",
  purchase_odometer: "",
  trim: "",
  vehicle_type: "suv",
  vin: "",
  year: "2020",
  ...overrides,
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

class MockVehicleQuery {
  private filters: Filter[] = [];
  private mutation: Mutation = null;

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

  maybeSingle() {
    return Promise.resolve(this.getSingleResult());
  }

  select() {
    return this;
  }

  single() {
    return Promise.resolve(this.getSingleResult());
  }

  update(payload: Record<string, unknown>) {
    this.mutation = { payload, type: "update" };
    mocks.updatePayloads.push(payload);
    return this;
  }

  private getSingleResult() {
    if (this.mutation?.type === "insert") {
      const row: CloudVehicleRow = {
        archived_at: null,
        created_at: "2026-01-03T00:00:00.000Z",
        id: `created-${mocks.rows.length + 1}`,
        updated_at: "2026-01-03T00:00:00.000Z",
        ...(this.mutation.payload as Omit<
          CloudVehicleRow,
          "archived_at" | "created_at" | "id" | "updated_at"
        >),
      };
      mocks.rows.push(row);

      return { data: row, error: null };
    }

    if (this.mutation?.type === "update") {
      const matchingRows = this.getRows();
      const row = matchingRows[0];

      if (!row) {
        return { data: null, error: null };
      }

      Object.assign(row, this.mutation.payload, {
        updated_at: "2026-01-04T00:00:00.000Z",
      });

      return { data: row, error: null };
    }

    return { data: this.getRows()[0] ?? null, error: null };
  }

  private getRows() {
    return mocks.rows.filter((row) =>
      this.filters.every((filter) => {
        const value = row[filter.column as keyof CloudVehicleRow];

        if (filter.operation === "eq") {
          return value === filter.value;
        }

        if (filter.operation === "is") {
          return value === null || value === undefined;
        }

        return value !== null && value !== undefined;
      }),
    );
  }
}

const createMockSupabaseClient = () => ({
  from: (table: string) => {
    if (table !== "vehicles") {
      throw new Error(`Unexpected table ${table}`);
    }

    return new MockVehicleQuery();
  },
});

describe("web cloud vehicle mutations", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(createMockSupabaseClient());
    mocks.rows = [];
    mocks.updatePayloads = [];
  });

  it("maps create payloads for Supabase vehicles", () => {
    expect(
      toWebCloudVehicleCreatePayload({
        input: {
          current_odometer: 42000,
          make: "Toyota",
          model: "RAV4",
          nickname: "Family SUV",
          odometer_unit: "mi",
          vehicle_type: "suv",
          year: 2020,
        },
        localId: "web_local_1",
        userId: "user-1",
      }),
    ).toEqual({
      color: null,
      current_odometer: 42000,
      initial_odometer: 42000,
      license_plate: null,
      license_state: null,
      local_id: "web_local_1",
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
    });
  });

  it("preserves the lower initial odometer when mapping update payloads", () => {
    const payload = toWebCloudVehicleUpdatePayload({
      existingInitialOdometer: 40000,
      input: {
        current_odometer: 39000,
        make: "Toyota",
        model: "RAV4",
        nickname: "Family SUV",
        odometer_unit: "mi",
        vehicle_type: "suv",
        year: 2020,
      },
    });

    expect(payload.initial_odometer).toBe(39000);
    expect(payload.current_odometer).toBe(39000);
  });

  it("creates a cloud vehicle from validated form-shaped input", async () => {
    const vehicle = await createWebCloudVehicle({
      input: createVehicleInput({
        color: "Silver",
        notes: "Primary road trip car",
        purchase_odometer: "40000",
        trim: "XLE",
      }),
      userId: "user-1",
    });

    expect(vehicle.id).toBe("created-1");
    expect(vehicle.initial_odometer).toBe(42000);
    expect(vehicle.current_odometer).toBe(42000);
    expect(vehicle.color).toBe("Silver");
    expect(vehicle.notes).toBe("Primary road trip car");
    expect(vehicle.purchase_odometer).toBe(40000);
    expect(vehicle.sync_status).toBe("synced");
    expect(mocks.rows).toHaveLength(1);
  });

  it("surfaces validation errors before writing", async () => {
    await expect(
      createWebCloudVehicle({
        input: createVehicleInput({ nickname: "" }),
        userId: "user-1",
      }),
    ).rejects.toThrow("Nickname is required.");

    expect(mocks.rows).toHaveLength(0);
  });

  it("updates only active vehicles owned by the signed-in user", async () => {
    mocks.rows = [
      createVehicleRow(),
      createVehicleRow({
        id: "other-user-vehicle",
        local_id: "other-user-vehicle",
        user_id: "user-2",
      }),
    ];

    const updated = await updateWebCloudVehicle({
      input: createVehicleInput({
        current_odometer: "43000",
        nickname: "Updated SUV",
      }),
      userId: "user-1",
      vehicleId: "vehicle-1",
    });
    const notOwned = await updateWebCloudVehicle({
      input: createVehicleInput({ nickname: "Should Not Change" }),
      userId: "user-1",
      vehicleId: "other-user-vehicle",
    });

    expect(updated?.nickname).toBe("Updated SUV");
    expect(updated?.current_odometer).toBe(43000);
    expect(notOwned).toBeNull();
    expect(
      mocks.rows.find((row) => row.id === "other-user-vehicle")?.nickname,
    ).toBe("Family SUV");
  });

  it("does not update missing or archived vehicles", async () => {
    mocks.rows = [
      createVehicleRow({
        archived_at: "2026-01-03T00:00:00.000Z",
      }),
    ];

    const archived = await updateWebCloudVehicle({
      input: createVehicleInput({ nickname: "Should Not Change" }),
      userId: "user-1",
      vehicleId: "vehicle-1",
    });
    const missing = await updateWebCloudVehicle({
      input: createVehicleInput({ nickname: "Missing" }),
      userId: "user-1",
      vehicleId: "missing",
    });

    expect(archived).toBeNull();
    expect(missing).toBeNull();
    expect(mocks.rows[0]?.nickname).toBe("Family SUV");
  });

  it("archives only active owned vehicles", async () => {
    mocks.rows = [
      createVehicleRow(),
      createVehicleRow({
        id: "already-archived",
        archived_at: "2026-01-03T00:00:00.000Z",
        local_id: "already-archived",
      }),
      createVehicleRow({
        id: "other-user-vehicle",
        local_id: "other-user-vehicle",
        user_id: "user-2",
      }),
    ];

    await expect(
      archiveWebCloudVehicle({ userId: "user-1", vehicleId: "vehicle-1" }),
    ).resolves.toBe(true);
    await expect(
      archiveWebCloudVehicle({
        userId: "user-1",
        vehicleId: "already-archived",
      }),
    ).resolves.toBe(false);
    await expect(
      archiveWebCloudVehicle({
        userId: "user-1",
        vehicleId: "other-user-vehicle",
      }),
    ).resolves.toBe(false);

    expect(mocks.rows[0]?.archived_at).toEqual(expect.any(String));
    expect(
      mocks.rows.find((row) => row.id === "other-user-vehicle")?.archived_at,
    ).toBeNull();
  });

  it("restores only archived owned vehicles", async () => {
    mocks.rows = [
      createVehicleRow(),
      createVehicleRow({
        id: "archived",
        archived_at: "2026-01-03T00:00:00.000Z",
        local_id: "archived",
      }),
      createVehicleRow({
        id: "other-user-vehicle",
        archived_at: "2026-01-03T00:00:00.000Z",
        local_id: "other-user-vehicle",
        user_id: "user-2",
      }),
    ];

    await expect(
      restoreWebCloudVehicle({ userId: "user-1", vehicleId: "archived" }),
    ).resolves.toBe(true);
    await expect(
      restoreWebCloudVehicle({ userId: "user-1", vehicleId: "vehicle-1" }),
    ).resolves.toBe(false);
    await expect(
      restoreWebCloudVehicle({
        userId: "user-1",
        vehicleId: "other-user-vehicle",
      }),
    ).resolves.toBe(false);

    expect(mocks.rows.find((row) => row.id === "archived")?.archived_at).toBeNull();
    expect(
      mocks.rows.find((row) => row.id === "other-user-vehicle")?.archived_at,
    ).toBe("2026-01-03T00:00:00.000Z");
  });
});
