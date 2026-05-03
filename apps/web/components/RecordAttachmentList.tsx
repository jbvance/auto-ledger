import {
  formatAttachmentFileSize,
  formatAttachmentTypeLabel,
  getAttachmentDisplayName,
  type RecordAttachment,
} from "@autoledger/shared";
import { ExternalLink, FileText } from "lucide-react";

import { RecordAttachmentDeleteForm } from "./RecordAttachmentActions";
import type { RecordAttachmentDeleteActionState } from "../app/vehicles/recordAttachmentActions";

type DeleteAction = (
  previousState: RecordAttachmentDeleteActionState,
  formData: FormData,
) => Promise<RecordAttachmentDeleteActionState>;

export type RecordAttachmentSectionProps = {
  attachments: RecordAttachment[];
  deleteAction?: DeleteAction;
  description: string;
  emptyMessage?: string;
  getAttachmentHref: (attachment: RecordAttachment) => string;
  recordId?: string;
  recordType?: "repair" | "service";
  title?: string;
  uploadForm?: React.ReactNode;
  vehicleId?: string;
};

export const getWebRecordAttachmentDisplayMetadata = (
  attachment: RecordAttachment,
) => ({
  createdLabel: formatCreatedAt(attachment.created_at),
  displayName: getAttachmentDisplayName(attachment),
  fileSizeLabel: formatAttachmentFileSize(attachment.file_size_bytes),
  fileTypeLabel: formatAttachmentTypeLabel(attachment.file_type),
  mimeTypeLabel: attachment.mime_type.trim() || "File type unknown",
});

export function RecordAttachmentSection({
  attachments,
  deleteAction,
  description,
  emptyMessage = "No receipts or documents attached yet.",
  getAttachmentHref,
  recordId,
  recordType,
  title = "Attachments",
  uploadForm,
  vehicleId,
}: RecordAttachmentSectionProps) {
  const canDelete = Boolean(deleteAction && recordId && recordType && vehicleId);

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
      {uploadForm}
      {attachments.length === 0 ? (
        <div className="mt-4 rounded-lg bg-[var(--background)] p-3">
          <p className="text-sm leading-6 text-[var(--muted)]">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {attachments.map((attachment) => (
            <RecordAttachmentRow
              attachment={attachment}
              deleteAction={canDelete ? deleteAction : undefined}
              href={getAttachmentHref(attachment)}
              key={attachment.id}
              recordId={recordId}
              recordType={recordType}
              vehicleId={vehicleId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RecordAttachmentRow({
  attachment,
  deleteAction,
  href,
  recordId,
  recordType,
  vehicleId,
}: {
  attachment: RecordAttachment;
  deleteAction?: DeleteAction;
  href: string;
  recordId?: string;
  recordType?: "repair" | "service";
  vehicleId?: string;
}) {
  const metadata = getWebRecordAttachmentDisplayMetadata(attachment);
  const canDelete = Boolean(deleteAction && recordId && recordType && vehicleId);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)]">
          <FileText aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold text-[var(--foreground)]">
            {metadata.displayName}
          </h3>
          <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
            {metadata.fileTypeLabel} - {metadata.fileSizeLabel}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-[var(--muted)]">
            {metadata.mimeTypeLabel}
            {metadata.createdLabel ? ` - Added ${metadata.createdLabel}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <a
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--foreground)] transition hover:text-[var(--primary)]"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Open
        </a>
        {canDelete ? (
          <RecordAttachmentDeleteForm
            action={deleteAction as DeleteAction}
            attachmentId={attachment.id}
            recordId={recordId as string}
            recordType={recordType as "repair" | "service"}
            vehicleId={vehicleId as string}
          />
        ) : null}
      </div>
    </article>
  );
}

function formatCreatedAt(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}
