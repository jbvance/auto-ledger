# Account and Data Deletion Plan

This plan covers safe deletion for AutoLedger account data. It is intentionally
separate from the current account/data privacy controls UI: cloud account
deletion is not live yet, and no client or mobile code should ever receive a
Supabase service role key.

## Current Foundation

- Mobile Settings has Account & Data Controls that explain local guest data
  versus cloud account data.
- Mobile local guest data deletion is device-only, export-first, and guarded by
  typed confirmation.
- Web `/settings` explains cloud account data, links to cloud CSV export, and
  shows account/cloud deletion as planned and inactive.
- Web `/settings/export` exports signed-in cloud records as CSV. It does not
  export attachment file binaries or PDF files.

## Cloud Data To Delete

Cloud account deletion must consider these user-owned tables:

- `public.record_attachments`
- `public.maintenance_reminders`
- `public.odometer_entries`
- `public.service_records`
- `public.repair_records`
- `public.vendors`
- `public.vehicles`
- `public.profiles`
- `auth.users`

Recommended deletion order:

1. Load `public.record_attachments` rows for the signed-in user and collect
   `storage_bucket` plus `storage_path` values.
2. Delete related Supabase Storage objects from the private
   `record-attachments` bucket.
3. Delete `public.record_attachments` metadata rows.
4. Delete `public.maintenance_reminders`.
5. Delete `public.odometer_entries`.
6. Delete `public.service_records`.
7. Delete `public.repair_records`.
8. Delete `public.vendors`.
9. Delete `public.vehicles`.
10. Delete `public.profiles` or let the Auth user deletion cascade to it.
11. Delete the Supabase Auth user through the Supabase Admin API.

The exact order matters because the current cloud schema uses `on delete
restrict` for most user-owned child rows. Deleting `auth.users` first will be
blocked while `vehicles`, records, reminders, attachments, or vendors still
reference that user.

## Supabase Auth User Deletion

Deleting the Auth user requires Supabase Admin privileges. Implement this only
from a trusted server runtime, such as a Next.js server route, server action, or
Supabase Edge Function that has access to `SUPABASE_SERVICE_ROLE_KEY`.

The server flow should:

- Verify the current session with the normal anon-key Supabase client.
- Derive the user ID from the verified session, not from arbitrary client input.
- Require recent reauthentication or another strong confirmation before any
  destructive step.
- Perform a dry-run/count step before deletion so the user can review what will
  be removed.
- Delete table data and Storage objects before deleting the Auth user.
- Return a clear result without logging private record contents, signed URLs,
  or file names unless necessary for debugging.

## Service Role Key Safety

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and must remain server-only. It must
not appear in:

- Expo mobile code
- browser/client components
- public environment variables such as `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`
- bundled test fixtures that could be copied into client code

Client and mobile code should only use public anon keys with RLS.

## Storage Object Cleanup

Storage files do not automatically disappear when `public.record_attachments`
rows are deleted. The deletion flow must remove objects from the private
`record-attachments` bucket before or during metadata deletion.

Recommended behavior:

- Query attachment metadata for the signed-in user.
- Delete only paths whose bucket is `record-attachments` and whose first path
  segment matches the user ID.
- Treat missing Storage objects as idempotent success.
- If Storage deletion fails, stop before deleting the Auth user and report a
  retryable failure.
- Avoid logging signed URLs or private file contents.

## RLS And Cascading Deletes

RLS protects normal user-session reads and writes. It is still valuable for
user-scoped deletion of table rows, but the final Auth user deletion requires
Admin privileges. A service-role server client bypasses RLS, so the server must
enforce user scoping explicitly with `where user_id = session.user.id` or
equivalent constraints.

`public.profiles` references `auth.users(id)` with `on delete cascade`, but the
other user-owned cloud tables reference `auth.users(id)` with `on delete
restrict`. The deletion implementation should not assume Auth deletion will
cascade all product data.

## Local Guest Data

Local guest data is separate from cloud account data. Deleting an AutoLedger
cloud account must not automatically delete local guest records on a device.

Local guest cleanup should remain a separate mobile-only flow that:

- Explains that records are stored on this device.
- Encourages CSV export first.
- Requires typed confirmation.
- Deletes local SQLite rows and app-owned local attachment files only after
  confirmation.
- Does not delete cloud account data.

## Recommended Implementation Slices

1. Foundation UI and docs: explain data locations, link to CSV exports, provide
   mobile typed-confirmation local cleanup, and keep cloud deletion inactive.
2. Server-only dry run: add a server route/action that verifies the current
   session and returns cloud table and Storage object counts without deleting.
3. Server-only cloud data deletion: delete Storage objects and user-owned table
   rows in a tested order, with idempotent retry handling.
4. Account deletion: after cloud data deletion succeeds, delete the Supabase
   Auth user through the Admin API and sign out the current session.
5. Support and audit hardening: add manual recovery guidance, monitoring for
   partial failures, and regression tests around service-role isolation.

## Non-Goals For This Slice

- No PDF export.
- No household deletion or transfer behavior.
- No automatic guest-to-account sync cleanup.
- No client-side cloud account deletion button.
- No service-role key exposure to mobile or browser code.
