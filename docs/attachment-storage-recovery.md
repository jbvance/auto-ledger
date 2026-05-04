# Attachment Storage Recovery

This guide covers cloud service/repair attachment partial failures. It is for
developers and trusted operators working in Supabase; it does not introduce a
user-facing admin portal.

## Expected Upload Sequence

Cloud attachment upload should run in this order:

1. Validate file metadata and size.
2. Generate a user-scoped Storage path under `record-attachments`.
3. Upload the file to the private Supabase Storage bucket.
4. Insert the `public.record_attachments` metadata row.

If Storage upload fails, the app does not insert metadata and reports that the
file could not be uploaded.

If metadata insert fails after Storage upload succeeds, the app attempts to
remove the uploaded Storage object. If that cleanup fails, the app reports that
cleanup was attempted and does not claim the upload succeeded.

## Expected Delete Sequence

Cloud attachment delete should run in this order:

1. Load the attachment metadata through the signed-in user's RLS-scoped session.
2. Remove the private Storage object when a `storage_path` exists.
3. Delete the `public.record_attachments` metadata row.

If Storage delete fails, the app does not delete metadata. This keeps the
attachment visible so the user can retry instead of silently losing the record.

If the Storage object is already missing, the app treats that as an idempotent
cleanup case and still attempts to delete the metadata row.

If Storage delete succeeds but metadata delete fails, the app logs a safe
non-sensitive warning and reports that the attachment record could not be
cleared. Retrying delete should clear the remaining metadata row.

## Partial Failure Modes

| failure | expected app behavior | likely recovery |
| --- | --- | --- |
| Storage upload fails before metadata insert | No metadata row is inserted. User sees an upload failure. | Retry upload after checking bucket/policies/network. |
| Metadata insert fails after upload | App attempts Storage cleanup and reports failure. | If cleanup failed, remove orphaned object or retry after checking SQL/RLS. |
| Storage delete fails | Metadata remains. User sees delete failure. | Retry delete after checking Storage policy/network. |
| Storage already missing during delete | Metadata delete continues. | No manual action if metadata delete succeeds. |
| Metadata delete fails after Storage delete | File is gone, metadata remains. User sees partial delete failure. | Retry delete or manually remove metadata row after confirming ownership. |

## Orphan Report

Run this read-only SQL in the Supabase SQL editor:

```text
packages/db/sql/006_report_attachment_storage_orphans.sql
```

Expected result: zero rows.

Rows with `metadata_missing_storage` mean a `public.record_attachments` row
points to a missing Storage object.

Rows with `storage_missing_metadata` mean a private Storage object exists
without matching `public.record_attachments` metadata.

## Manual Recovery

Before changing anything:

- Confirm you are in the correct Supabase project and environment.
- Export or screenshot the orphan report result for audit notes.
- Confirm the object path starts with the affected user's UUID.
- Do not create public bucket policies or public URLs.
- Do not use or expose service role keys in mobile or browser code.

For `metadata_missing_storage`:

- Prefer asking the user to retry delete from the app.
- If manual cleanup is required, delete only the affected
  `public.record_attachments` row after confirming `user_id`, parent record,
  and `storage_path`.

For `storage_missing_metadata`:

- Confirm there is no matching metadata row for the exact bucket/path.
- Delete only the orphaned object from the private `record-attachments` bucket.
- Keep the bucket private.

## What Not To Do

- Do not make `record-attachments` public.
- Do not add public or anon Storage policies.
- Do not paste signed URLs into logs, tickets, or docs.
- Do not delete broad user folders unless the user is going through a verified
  account/data deletion flow.
- Do not weaken RLS to work around attachment cleanup failures.

## Related Files

- Mobile cloud attachments: `apps/mobile/lib/cloudRecordAttachments.ts`
- Web cloud attachments: `apps/web/lib/cloud/recordAttachmentData.ts`
- Storage SQL: `packages/db/sql/003_record_attachments_storage_rls.sql`
- Live verification: `docs/supabase-live-verification.md`
- Orphan report SQL: `packages/db/sql/006_report_attachment_storage_orphans.sql`
