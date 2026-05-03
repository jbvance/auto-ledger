"use client";

import { FileUp, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import type {
  RecordAttachmentDeleteActionState,
  RecordAttachmentUploadActionState,
} from "../app/vehicles/recordAttachmentActions";

const initialUploadState: RecordAttachmentUploadActionState = {
  error: null,
  message: null,
  revision: 0,
  status: "idle",
};

const initialDeleteState: RecordAttachmentDeleteActionState = {
  error: null,
  message: null,
  revision: 0,
  status: "idle",
};

type UploadAction = (
  previousState: RecordAttachmentUploadActionState,
  formData: FormData,
) => Promise<RecordAttachmentUploadActionState>;

type DeleteAction = (
  previousState: RecordAttachmentDeleteActionState,
  formData: FormData,
) => Promise<RecordAttachmentDeleteActionState>;

export function RecordAttachmentUploadForm({
  action,
  recordId,
  recordType,
  vehicleId,
}: {
  action: UploadAction;
  recordId: string;
  recordType: "repair" | "service";
  vehicleId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialUploadState);
  const recordIdName =
    recordType === "service" ? "service_record_id" : "repair_record_id";

  useEffect(() => {
    if (state.status === "success" && state.revision > 0) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.revision, state.status]);

  return (
    <form
      action={formAction}
      className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
      encType="multipart/form-data"
      ref={formRef}
    >
      <input name="vehicle_id" type="hidden" value={vehicleId} />
      <input name={recordIdName} type="hidden" value={recordId} />
      <label className="block space-y-2">
        <span className="text-sm font-bold text-[var(--foreground)]">
          Add receipt or document
        </span>
        <input
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="block w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
          name="attachment_file"
          type="file"
        />
      </label>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        Photos up to 10 MB and PDFs up to 25 MB are stored privately in
        Supabase.
      </p>
      {state.error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {state.message}
        </p>
      ) : null}
      <div className="mt-3">
        <UploadSubmitButton />
      </div>
    </form>
  );
}

export function RecordAttachmentDeleteForm({
  action,
  attachmentId,
  recordId,
  recordType,
  vehicleId,
}: {
  action: DeleteAction;
  attachmentId: string;
  recordId: string;
  recordType: "repair" | "service";
  vehicleId: string;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction] = useActionState(action, initialDeleteState);
  const recordIdName =
    recordType === "service" ? "service_record_id" : "repair_record_id";

  useEffect(() => {
    if (state.status === "success" && state.revision > 0) {
      router.refresh();
    }
  }, [router, state.revision, state.status]);

  if (!isConfirming) {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800"
          onClick={() => setIsConfirming(true)}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </button>
        {state.error ? (
          <p className="max-w-xs text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-bold text-red-900">Delete attachment?</p>
      <p className="mt-1 text-sm leading-5 text-red-800">
        This removes the private file and its cloud metadata.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={formAction}>
          <input name="attachment_id" type="hidden" value={attachmentId} />
          <input name="vehicle_id" type="hidden" value={vehicleId} />
          <input name={recordIdName} type="hidden" value={recordId} />
          <DeleteSubmitButton />
        </form>
        <button
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-800"
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

function UploadSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <FileUp aria-hidden="true" className="size-4" />
      {pending ? "Uploading..." : "Upload Attachment"}
    </button>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Trash2 aria-hidden="true" className="size-4" />
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
