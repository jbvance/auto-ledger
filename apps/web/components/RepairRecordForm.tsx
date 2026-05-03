"use client";

import {
  formatOdometer,
  repairRecordCategoryLabels,
  repairRecordCategoryValues,
  type RepairRecordCategory,
  type Vehicle,
} from "@autoledger/shared";
import { Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { WebRepairRecordFormValues } from "../lib/cloud/repairRecordFormValues";

type RepairRecordFormActionState = {
  error: null | string;
};

type RepairRecordDeleteActionState = {
  error: null | string;
};

export function RepairRecordForm({
  action,
  cancelHref,
  defaultValues,
  description,
  repairRecordId,
  submitLabel,
  vehicle,
}: {
  action: (
    previousState: RepairRecordFormActionState,
    formData: FormData,
  ) => Promise<RepairRecordFormActionState>;
  cancelHref: string;
  defaultValues: WebRepairRecordFormValues;
  description: string;
  repairRecordId?: string;
  submitLabel: string;
  vehicle: Vehicle;
}) {
  const [state, formAction] = useActionState(action, { error: null });

  return (
    <form
      action={formAction}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      <input name="vehicle_id" type="hidden" value={defaultValues.vehicle_id} />
      <input name="cost_currency" type="hidden" value="USD" />
      {repairRecordId ? (
        <input name="repair_record_id" type="hidden" value={repairRecordId} />
      ) : null}

      <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>

      <div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4">
        <p className="text-sm font-bold uppercase text-[var(--muted)]">
          Vehicle
        </p>
        <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
          {vehicle.nickname}
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          Current cloud odometer:{" "}
          {formatOdometer(vehicle.current_odometer, vehicle.odometer_unit)}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TextField
          defaultValue={defaultValues.title}
          label="Title"
          name="title"
          placeholder="Brake repair"
          required
        />
        <SelectField
          defaultValue={defaultValues.category}
          label="Category"
          name="category"
          options={repairRecordCategoryValues.map((value) => ({
            label: repairRecordCategoryLabels[value],
            value,
          }))}
        />
        <TextField
          defaultValue={defaultValues.repair_date}
          label="Repair Date"
          name="repair_date"
          required
          type="date"
        />
        <TextField
          badge={vehicle.odometer_unit}
          defaultValue={defaultValues.odometer_reading}
          label="Odometer Reading"
          min={0}
          name="odometer_reading"
          placeholder={`${vehicle.current_odometer}`}
          type="number"
        />
        <TextField
          autoComplete="off"
          defaultValue={defaultValues.vendor_name}
          label="Vendor / Shop"
          name="vendor_name"
          placeholder="Local mechanic or dealership"
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_96px]">
          <TextField
            defaultValue={defaultValues.cost_amount}
            label="Cost"
            min={0}
            name="cost_amount"
            placeholder="450.00"
            step="0.01"
            type="number"
          />
          <div className="block space-y-2">
            <p className="text-sm font-bold text-[var(--foreground)]">
              Currency
            </p>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-base font-semibold text-[var(--foreground)]">
              USD
            </div>
          </div>
        </div>
      </div>

      <section className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          Optional Warranty
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField
            defaultValue={defaultValues.warranty_until_date}
            label="Warranty Until Date"
            name="warranty_until_date"
            type="date"
          />
          <TextField
            badge={vehicle.odometer_unit}
            defaultValue={defaultValues.warranty_until_odometer}
            label="Warranty Until Odometer"
            min={0}
            name="warranty_until_odometer"
            placeholder="60000"
            type="number"
          />
        </div>
      </section>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-bold text-[var(--foreground)]">
          Description
        </span>
        <textarea
          className="min-h-28 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)]"
          defaultValue={defaultValues.description}
          name="description"
          placeholder="Work performed, diagnosis, or parts replaced"
        />
      </label>

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
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm font-bold text-[var(--foreground)]"
          href={cancelHref}
        >
          <X aria-hidden="true" className="size-4" />
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function RepairRecordDeleteForm({
  action,
  repairRecordId,
  vehicleId,
}: {
  action: (
    previousState: RepairRecordDeleteActionState,
    formData: FormData,
  ) => Promise<RepairRecordDeleteActionState>;
  repairRecordId: string;
  vehicleId: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <div className="flex flex-col gap-2">
        <button
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
          onClick={() => setIsConfirming(true)}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Delete Repair Record
        </button>
        {state.error ? (
          <p className="text-sm font-semibold text-red-700">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-900">Delete repair record?</p>
      <p className="mt-1 text-sm leading-5 text-red-800">
        This removes only this cloud repair record. The parent vehicle stays in
        your account. Cloud attachment deletion is deferred in this web slice,
        so records with attachments may need attachment cleanup later.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={formAction}>
          <input name="vehicle_id" type="hidden" value={vehicleId} />
          <input
            name="repair_record_id"
            type="hidden"
            value={repairRecordId}
          />
          <DeleteSubmitButton />
        </form>
        <button
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-800"
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
          Cancel
        </button>
      </div>
      {state.error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p>
      ) : null}
    </div>
  );
}

function TextField({
  badge,
  label,
  name,
  type = "text",
  ...inputProps
}: {
  autoComplete?: string;
  badge?: string;
  defaultValue: string;
  label: string;
  min?: number;
  name: keyof WebRepairRecordFormValues;
  placeholder?: string;
  required?: boolean;
  step?: string;
  type?: "date" | "number" | "text";
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
        <span>{label}</span>
        {badge ? (
          <span className="rounded-md bg-[var(--background)] px-2 py-1 text-xs font-bold uppercase text-[var(--muted)]">
            {badge}
          </span>
        ) : null}
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
  defaultValue: RepairRecordCategory;
  label: string;
  name: "category";
  options: Array<{
    label: string;
    value: RepairRecordCategory;
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
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Save aria-hidden="true" className="size-4" />
      {pending ? "Saving..." : label}
    </button>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-800 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Trash2 aria-hidden="true" className="size-4" />
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
