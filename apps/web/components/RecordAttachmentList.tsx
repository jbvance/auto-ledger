import {
  formatAttachmentFileSize,
  formatAttachmentTypeLabel,
  getAttachmentDisplayName,
  type RecordAttachment,
} from "@autoledger/shared";
import { ExternalLink, FileText } from "lucide-react";

export type RecordAttachmentSectionProps = {
  attachments: RecordAttachment[];
  description: string;
  emptyMessage?: string;
  getAttachmentHref: (attachment: RecordAttachment) => string;
  title?: string;
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
  description,
  emptyMessage = "No receipts or documents attached yet.",
  getAttachmentHref,
  title = "Attachments",
}: RecordAttachmentSectionProps) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
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
              href={getAttachmentHref(attachment)}
              key={attachment.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RecordAttachmentRow({
  attachment,
  href,
}: {
  attachment: RecordAttachment;
  href: string;
}) {
  const metadata = getWebRecordAttachmentDisplayMetadata(attachment);

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
      <a
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--foreground)] transition hover:text-[var(--primary)]"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        Open
      </a>
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
