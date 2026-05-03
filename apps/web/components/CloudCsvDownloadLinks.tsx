"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import type { WebCloudCsvExportFile } from "../lib/cloud/exportData";

export function CloudCsvDownloadLinks({
  files,
}: {
  files: WebCloudCsvExportFile[];
}) {
  const [downloadedFileName, setDownloadedFileName] = useState<null | string>(
    null,
  );

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {files.map((file) => (
        <article
          className="flex flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
          key={file.id}
        >
          <div>
            <h2 className="text-lg font-bold">{file.label}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {file.description}
            </p>
            <p className="mt-2 break-words text-xs font-semibold text-[var(--muted)]">
              {file.fileName}
            </p>
          </div>
          <a
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
            download={file.fileName}
            href={`/settings/export/${file.id}`}
            onClick={() => setDownloadedFileName(file.fileName)}
          >
            <Download aria-hidden="true" className="size-4" />
            Download CSV
          </a>
        </article>
      ))}
      {downloadedFileName ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 lg:col-span-2">
          Download requested for {downloadedFileName}. The file is generated in
          your browser session and is not uploaded anywhere.
        </p>
      ) : null}
    </div>
  );
}

