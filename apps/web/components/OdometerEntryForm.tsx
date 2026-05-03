"use client";

import {
  formatOdometer,
  type Vehicle,
} from "@autoledger/shared";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { WebOdometerEntryFormValues } from "../lib/cloud/odometerFormValues";

type OdometerEntryFormActionState = {
  error: null | string;
};

type OdometerEntryDeleteActionState = {
  error: null | string;
};

export function OdometerEntryForm({
  action,
  cancelHref,
  defaultValues,
  description,
  entryId,
  submitLabel,
  vehicle,
}: {
  action: (
    previousState: OdometerEntryFormActionState,
    formData: FormData,
  ) => Promise<OdometerEntryFormActionState>;
  cancelHref: string;
  defaultValues: WebOdometerEntryFormValues;
  description: string;
  entryId?: string;
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
      <input
        name="odometer_unit"
        type="hidden"
        value={defaultValues.odometer_unit}
      />
      <input name="source_type" type="hidden" value="manual" />
      {entryId ? <input name="entry_id" type="hidden" value={entryId} /> : null}

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
          badge={vehicle.odometer_unit}
          defaultValue={defaultValues.reading}
          helpText="Enter the odometer reading shown on the vehicle."
          label="Reading"
          min={0}
          name="reading"
          required
          type="number"
        />
        <TextField
          defaultValue={defaultValues.reading_date}
          label="Reading Date"
          name="reading_date"
          required
          type="date"
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
          placeholder="Optional context"
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

export function OdometerEntryDeleteForm({
  action,
  vehicleId,
  entryId,
}: {
  action: (
    previousState: OdometerEntryDeleteActionState,
    formData: FormData,
  ) => Promise<OdometerEntryDeleteActionState>;
  entryId: string;
  vehicleId: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <div className="flex flex-col gap-2">
        <button
          className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
          onClick={() => setIsConfirming(true)}
          type="button"
        >
          Delete Reading
        </button>
        {state.error ? (
          <p className="text-sm font-semibold text-red-700">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-900">
        Delete odometer entry?
      </p>
      <p className="mt-1 text-sm leading-5 text-red-800">
        This cloud reading will be removed and the vehicle odometer will be
        recalculated from remaining cloud records.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={formAction}>
          <input name="vehicle_id" type="hidden" value={vehicleId} />
          <input name="entry_id" type="hidden" value={entryId} />
          <DeleteSubmitButton />
        </form>
        <button
          className="cursor-pointer rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-800"
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
      {state.error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function TextField({
  badge,
  helpText,
  label,
  name,
  type,
  ...inputProps
}: {
  badge?: string;
  defaultValue: string;
  helpText?: string;
  label: string;
  min?: number;
  name: "reading" | "reading_date";
  placeholder?: string;
  required?: boolean;
  type: "date" | "number";
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
      {helpText ? (
        <p className="text-sm leading-5 text-[var(--muted)]">{helpText}</p>
      ) : null}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="cursor-pointer rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="cursor-pointer rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-800 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
