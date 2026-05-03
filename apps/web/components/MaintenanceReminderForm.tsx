"use client";

import {
  formatOdometer,
  maintenanceReminderCategoryLabels,
  maintenanceReminderCategoryValues,
  maintenanceReminderTypeLabels,
  maintenanceReminderTypeValues,
  type MaintenanceReminderCategory,
  type MaintenanceReminderType,
  type Vehicle,
} from "@autoledger/shared";
import { CheckCircle2, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { WebMaintenanceReminderFormValues } from "../lib/cloud/maintenanceReminderFormValues";

type MaintenanceReminderFormActionState = {
  error: null | string;
};

type MaintenanceReminderStatusActionState = {
  error: null | string;
};

export function MaintenanceReminderForm({
  action,
  cancelHref,
  defaultValues,
  description,
  reminderId,
  submitLabel,
  vehicle,
}: {
  action: (
    previousState: MaintenanceReminderFormActionState,
    formData: FormData,
  ) => Promise<MaintenanceReminderFormActionState>;
  cancelHref: string;
  defaultValues: WebMaintenanceReminderFormValues;
  description: string;
  reminderId?: string;
  submitLabel: string;
  vehicle: Vehicle;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const [reminderType, setReminderType] = useState<MaintenanceReminderType>(
    defaultValues.reminder_type,
  );

  return (
    <form
      action={formAction}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      <input name="vehicle_id" type="hidden" value={defaultValues.vehicle_id} />
      {reminderId ? (
        <input name="reminder_id" type="hidden" value={reminderId} />
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
          required
        />
        <SelectField
          defaultValue={defaultValues.category}
          label="Category"
          name="category"
          options={maintenanceReminderCategoryValues.map((value) => ({
            label: maintenanceReminderCategoryLabels[value],
            value,
          }))}
        />
        <SelectField
          defaultValue={defaultValues.reminder_type}
          label="Reminder Type"
          name="reminder_type"
          onChange={setReminderType}
          options={maintenanceReminderTypeValues.map((value) => ({
            label: maintenanceReminderTypeLabels[value],
            value,
          }))}
        />
        {reminderType === "mileage" ? null : (
          <TextField
            defaultValue={defaultValues.due_date}
            label="Due Date"
            name="due_date"
            required={reminderType === "date"}
            type="date"
          />
        )}
        {reminderType === "date" ? null : (
          <TextField
            badge={vehicle.odometer_unit}
            defaultValue={defaultValues.due_odometer}
            label="Due Odometer"
            min={0}
            name="due_odometer"
            required={reminderType === "mileage"}
            type="number"
          />
        )}
      </div>

      <section className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          Optional Repeat
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField
            defaultValue={defaultValues.repeat_interval_months}
            label="Repeat Every Months"
            min={0}
            name="repeat_interval_months"
            type="number"
          />
          <TextField
            badge={vehicle.odometer_unit}
            defaultValue={defaultValues.repeat_interval_miles}
            label={`Repeat Every ${vehicle.odometer_unit}`}
            min={0}
            name="repeat_interval_miles"
            type="number"
          />
        </div>
      </section>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-bold text-[var(--foreground)]">
          Notes
        </span>
        <textarea
          className="min-h-28 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)]"
          defaultValue={defaultValues.notes}
          name="notes"
        />
      </label>

      <div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
        <p className="text-sm leading-6 text-[var(--muted)]">
          Reminders saved here are tied to your signed-in account. This web
          form does not schedule device notifications yet.
        </p>
      </div>

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

export function MaintenanceReminderCompleteForm({
  action,
  reminderId,
  vehicleId,
}: {
  action: (
    previousState: MaintenanceReminderStatusActionState,
    formData: FormData,
  ) => Promise<MaintenanceReminderStatusActionState>;
  reminderId: string;
  vehicleId: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <div className="flex flex-col gap-2">
        <button
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
          onClick={() => setIsConfirming(true)}
          type="button"
        >
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Mark Complete
        </button>
        {state.error ? (
          <p className="text-sm font-semibold text-red-700">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-bold text-emerald-900">
        Mark reminder complete?
      </p>
      <p className="mt-1 text-sm leading-5 text-emerald-800">
        This cloud reminder will remain visible as completed. No service record
        or notification is created by this web action.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={formAction}>
          <input name="vehicle_id" type="hidden" value={vehicleId} />
          <input name="reminder_id" type="hidden" value={reminderId} />
          <CompleteSubmitButton />
        </form>
        <button
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-800"
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
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

export function MaintenanceReminderDeleteForm({
  action,
  reminderId,
  vehicleId,
}: {
  action: (
    previousState: MaintenanceReminderStatusActionState,
    formData: FormData,
  ) => Promise<MaintenanceReminderStatusActionState>;
  reminderId: string;
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
          Delete Reminder
        </button>
        {state.error ? (
          <p className="text-sm font-semibold text-red-700">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-900">Delete reminder?</p>
      <p className="mt-1 text-sm leading-5 text-red-800">
        This removes only this cloud maintenance reminder. The parent vehicle
        and other records stay in your account.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={formAction}>
          <input name="vehicle_id" type="hidden" value={vehicleId} />
          <input name="reminder_id" type="hidden" value={reminderId} />
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
        <p className="mt-3 text-sm font-semibold text-red-700">
          {state.error}
        </p>
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
  badge?: string;
  defaultValue: string;
  label: string;
  min?: number;
  name: keyof WebMaintenanceReminderFormValues;
  placeholder?: string;
  required?: boolean;
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
  onChange,
  options,
}: {
  defaultValue: string;
  label: string;
  name: "category" | "reminder_type";
  onChange?: (value: MaintenanceReminderType) => void;
  options: Array<{
    label: string;
    value: MaintenanceReminderCategory | MaintenanceReminderType;
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
        onChange={(event) => {
          if (name === "reminder_type") {
            onChange?.(event.target.value as MaintenanceReminderType);
          }
        }}
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

function CompleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <CheckCircle2 aria-hidden="true" className="size-4" />
      {pending ? "Completing..." : "Complete"}
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
