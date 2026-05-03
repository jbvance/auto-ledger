"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type VehicleStatusActionState = {
  error: null | string;
};

export function VehicleArchiveRestoreForm({
  action,
  confirmMessage,
  label,
  variant = "secondary",
  vehicleId,
}: {
  action: (
    previousState: VehicleStatusActionState,
    formData: FormData,
  ) => Promise<VehicleStatusActionState>;
  confirmMessage?: string;
  label: string;
  variant?: "danger" | "secondary";
  vehicleId: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const [isConfirming, setIsConfirming] = useState(false);

  if (confirmMessage && !isConfirming) {
    return (
      <div className="flex flex-col gap-2">
        <button
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
          onClick={() => setIsConfirming(true)}
          type="button"
        >
          {label}
        </button>
        {state.error ? (
          <p className="max-w-sm text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {confirmMessage ? (
        <div className="max-w-sm rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-bold text-red-900">Archive vehicle?</p>
          <p className="mt-1 text-sm leading-5 text-red-800">
            {confirmMessage}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={formAction}>
              <input name="vehicle_id" type="hidden" value={vehicleId} />
              <SubmitButton label="Archive" variant="danger" />
            </form>
            <button
              className="rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-800"
              onClick={() => setIsConfirming(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form action={formAction}>
          <input name="vehicle_id" type="hidden" value={vehicleId} />
          <SubmitButton label={label} variant={variant} />
        </form>
      )}
      {state.error ? (
        <p className="max-w-sm text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({
  label,
  variant,
}: {
  label: string;
  variant: "danger" | "secondary";
}) {
  const { pending } = useFormStatus();
  const className =
    variant === "danger"
      ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800 disabled:opacity-70"
      : "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--foreground)] disabled:opacity-70";

  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? "Working..." : label}
    </button>
  );
}
