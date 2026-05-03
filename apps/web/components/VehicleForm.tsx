"use client";

import {
  odometerUnitLabels,
  odometerUnitValues,
  vehicleTypeLabels,
  vehicleTypeValues,
} from "@autoledger/shared";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { WebVehicleFormValues } from "../lib/cloud/vehicleFormValues";

type VehicleFormActionState = {
  error: null | string;
};

export function VehicleForm({
  action,
  cancelHref,
  defaultValues,
  description,
  submitLabel,
  vehicleId,
}: {
  action: (
    previousState: VehicleFormActionState,
    formData: FormData,
  ) => Promise<VehicleFormActionState>;
  cancelHref: string;
  defaultValues: WebVehicleFormValues;
  description: string;
  submitLabel: string;
  vehicleId?: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });

  return (
    <form
      action={formAction}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      {vehicleId ? (
        <input name="vehicle_id" type="hidden" value={vehicleId} />
      ) : null}

      <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.nickname}
          label="Nickname"
          name="nickname"
          placeholder="Family SUV"
          required
        />
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.make}
          label="Make"
          name="make"
          placeholder="Toyota"
          required
        />
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.model}
          label="Model"
          name="model"
          placeholder="RAV4"
          required
        />
        <TextField
          defaultValue={defaultValues.year}
          label="Year"
          min={1886}
          name="year"
          placeholder="2022"
          required
          type="number"
        />
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.trim}
          label="Trim"
          name="trim"
          placeholder="XLE"
        />
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.color}
          label="Color"
          name="color"
          placeholder="Silver"
        />
        <SelectField
          defaultValue={defaultValues.vehicle_type}
          label="Vehicle Type"
          name="vehicle_type"
          options={vehicleTypeValues.map((value) => ({
            label: vehicleTypeLabels[value],
            value,
          }))}
        />
        <TextField
          defaultValue={defaultValues.current_odometer}
          label="Current Odometer"
          min={0}
          name="current_odometer"
          placeholder="42500"
          required
          type="number"
        />
        <SelectField
          defaultValue={defaultValues.odometer_unit}
          label="Odometer Unit"
          name="odometer_unit"
          options={odometerUnitValues.map((value) => ({
            label: odometerUnitLabels[value],
            value,
          }))}
        />
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.vin}
          label="VIN"
          maxLength={17}
          name="vin"
          placeholder="Optional"
        />
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.license_plate}
          label="License Plate"
          name="license_plate"
          placeholder="Optional"
        />
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.license_state}
          label="License State"
          name="license_state"
          placeholder="TX"
        />
        <TextField
          defaultValue={defaultValues.purchase_date}
          label="Purchase Date"
          name="purchase_date"
          type="date"
        />
        <TextField
          defaultValue={defaultValues.purchase_odometer}
          label="Purchase Odometer"
          min={0}
          name="purchase_odometer"
          placeholder="Optional"
          type="number"
        />
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-bold text-[var(--foreground)]">
          Notes
        </span>
        <textarea
          className="min-h-28 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)]"
          defaultValue={defaultValues.notes}
          name="notes"
          placeholder="Anything helpful to remember"
        />
      </label>

      {state.error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-800">{state.error}</p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <SubmitButton label={submitLabel} />
        <Link
          className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm font-bold text-[var(--foreground)]"
          href={cancelHref}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function TextField({
  label,
  name,
  type = "text",
  ...inputProps
}: {
  autoComplete?: string;
  defaultValue: string;
  label: string;
  maxLength?: number;
  min?: number;
  name: keyof WebVehicleFormValues;
  placeholder?: string;
  required?: boolean;
  type?: "date" | "number" | "text";
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-[var(--foreground)]">
        {label}
      </span>
      <input
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)]"
        name={name}
        type={type}
        {...inputProps}
      />
    </label>
  );
}

function SelectField({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: string;
  label: string;
  name: "odometer_unit" | "vehicle_type";
  options: Array<{
    label: string;
    value: string;
  }>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-[var(--foreground)]">
        {label}
      </span>
      <select
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)]"
        defaultValue={defaultValue}
        name={name}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}
