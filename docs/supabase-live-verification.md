# Supabase Live Verification

Use this checklist to verify that the current Supabase dev project matches the
AutoLedger SQL security model before production launch. This package does not
change schema or app behavior; it helps confirm that the live project has the
expected tables, RLS, constraints, grants, and private Storage policies.

## Scope

Verify the live Supabase dev project for:

- authenticated cloud tables in `public`
- Row Level Security on every user-owned cloud table
- owner-scoped RLS policies
- `user_id + local_id` duplicate-prevention constraints
- key owner-scoped foreign keys and indexes
- private `record-attachments` Storage bucket
- owner-scoped `storage.objects` policies
- absence of broad public/anon read policies
- client environment files containing only public Supabase URL/anon keys

The mobile-only migration tables `migration_runs` and
`migration_entity_mappings` are local SQLite tables in
`apps/mobile/lib/database.ts`; they are not expected in the live Supabase
`public` schema.

## Prerequisites

1. Open the correct Supabase project.
2. Confirm you are verifying the intended environment, usually `dev` first.
3. Run the setup SQL files in this order if they have not already been applied:

```text
packages/db/sql/001_profiles_auth_foundation.sql
packages/db/sql/002_cloud_data_schema_rls.sql
packages/db/sql/003_record_attachments_storage_rls.sql
```

4. Run the read-only duplicate-prevention check:

```text
packages/db/sql/004_verify_local_id_unique_constraints.sql
```

5. Run the full live verification script:

```text
packages/db/sql/005_verify_live_supabase_security.sql
```

Every row from `005_verify_live_supabase_security.sql` should return `pass` or
`review`. Treat `fail` rows as blockers until reviewed and fixed.

## SQL Verification Steps

In the Supabase dashboard SQL editor, paste and run:

```text
packages/db/sql/005_verify_live_supabase_security.sql
```

The script checks:

- expected public tables exist:
  - `profiles`
  - `vehicles`
  - `vendors`
  - `odometer_entries`
  - `service_records`
  - `repair_records`
  - `maintenance_reminders`
  - `record_attachments`
- RLS is enabled on those user-owned tables
- authenticated table grants exist
- expected RLS policies exist for owner select/insert/update/delete
- RLS policy expressions mention `auth.uid()` and the expected owner column
- suspicious public/anon table policies are absent
- `user_id + local_id` unique constraints exist where applicable
- owner-scoped foreign keys exist where practical
- expected indexes exist
- the `record-attachments` bucket exists and is private
- expected `storage.objects` policies exist
- Storage policies mention the private bucket and `auth.uid()`
- suspicious public/anon Storage policies are absent

Manual review is still required because SQL catalog checks cannot fully prove
cross-user denial behavior.

## Manual RLS Checks

Use two test users in the dev project.

1. Sign in as User A in the mobile or web app.
2. Create at least one cloud vehicle.
3. Add one odometer entry, service record, repair record, maintenance reminder,
   and service or repair attachment.
4. Sign out.
5. Sign in as User B.
6. Confirm User B cannot see User A's vehicle or records in the app.
7. In the Supabase SQL editor, inspect rows and confirm User A rows have
   `user_id = User A auth.users.id`.
8. Attempt app-level edit/delete operations only on User B's own rows.
9. Confirm there are no public read policies for AutoLedger tables.

Do not add public read policies to make these checks pass.

## Storage Checks

In the Supabase dashboard:

1. Go to Storage.
2. Confirm bucket `record-attachments` exists.
3. Confirm the bucket is private, not public.
4. Confirm allowed MIME types are limited to JPEG, PNG, WebP, GIF, and PDF.
5. Confirm the file size limit is `26214400` bytes, or 25 MB.
6. Upload/open/delete a cloud service or repair attachment from the app as User
   A.
7. Confirm the object path starts with User A's UUID:

```text
{userId}/vehicles/{vehicleId}/service-records/{serviceRecordId}/{attachmentLocalId}-{fileName}
{userId}/vehicles/{vehicleId}/repair-records/{repairRecordId}/{attachmentLocalId}-{fileName}
```

8. Confirm the app opens files through signed URLs or authorized Storage access,
   not public URLs.
9. Sign in as User B and confirm User B cannot open or delete User A's
   attachment.

The current Storage policies scope direct Storage access by the first path
segment matching `auth.uid()`. Authenticated users can create objects under
their own folder only. The app separately verifies parent service/repair record
ownership before creating metadata or signed URLs.

## Env And Secrets Checklist

Confirm:

- mobile code uses `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` only
- web browser code uses `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` only
- `SUPABASE_SERVICE_ROLE_KEY`, if added later for server-only account deletion,
  is never placed in Expo mobile code, browser/client components,
  `EXPO_PUBLIC_*`, or `NEXT_PUBLIC_*`
- `.env` and `.env.*` files are gitignored
- committed `.env.example` files contain placeholders only
- no real Supabase secrets are committed

Useful local checks:

```sh
rg -n "SUPABASE_SERVICE_ROLE_KEY|service_role|service role" . -g "!node_modules"
git status --ignored --short .env .env.* apps/mobile/.env* apps/web/.env*
git ls-files .env.example apps/mobile/.env.example apps/web/.env.example
```

`apps/web/.env.example` may appear as ignored unless `.gitignore` is adjusted;
that is setup-documentation drift, not a client secret leak by itself.

## Manual Checks SQL

Use these spot checks if the full script reports `review` rows.

Check RLS:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'vehicles',
    'vendors',
    'odometer_entries',
    'service_records',
    'repair_records',
    'maintenance_reminders',
    'record_attachments'
  )
order by tablename;
```

Check public/anon policies:

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where (
    schemaname = 'public'
    and tablename in (
      'profiles',
      'vehicles',
      'vendors',
      'odometer_entries',
      'service_records',
      'repair_records',
      'maintenance_reminders',
      'record_attachments'
    )
  )
  or (
    schemaname = 'storage'
    and tablename = 'objects'
    and policyname like 'Record attachment files are %'
  )
order by schemaname, tablename, policyname;
```

Check bucket privacy:

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'record-attachments';
```

## Verification Result Template

Copy this section into a dated note or issue after each verification run.

```text
Supabase project name:
Supabase project ref:
Environment: dev / staging / prod
Date verified:
Verified by:

SQL setup files confirmed:
- [ ] 001_profiles_auth_foundation.sql
- [ ] 002_cloud_data_schema_rls.sql
- [ ] 003_record_attachments_storage_rls.sql
- [ ] 004_verify_local_id_unique_constraints.sql
- [ ] 005_verify_live_supabase_security.sql

005 result:
- pass rows:
- review rows:
- fail rows:

Manual checks completed:
- [ ] two-user table isolation
- [ ] cross-user create/read/update/delete denial
- [ ] private record-attachments bucket
- [ ] signed URL attachment open
- [ ] cross-user Storage open/delete denial
- [ ] no public/anon read policies
- [ ] service role key absent from mobile/browser env

Issues found:

Follow-up tasks:

Final decision:
- [ ] ready for next launch-hardening slice
- [ ] blocked until issues are fixed
```
