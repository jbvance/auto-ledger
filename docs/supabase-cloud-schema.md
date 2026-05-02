# Supabase Cloud Schema Setup

This document covers the current cloud data schema foundation for AutoLedger.

The SQL in this slice creates authenticated cloud tables, Row Level Security
policies, and a private Storage bucket for service/repair record attachments.
Mobile cloud vehicle CRUD, mobile cloud odometer entry CRUD, mobile cloud
service record CRUD, mobile cloud repair record CRUD, mobile cloud maintenance
reminder CRUD, and mobile cloud service/repair attachment upload/list/open/delete
are implemented. The app does not yet implement cloud vendor CRUD,
guest-to-account migration, vehicle-level cloud documents, OCR, or cloud push
notifications.

## SQL Files

Run these files in order in the Supabase dashboard SQL editor:

1. `packages/db/sql/001_profiles_auth_foundation.sql`
2. `packages/db/sql/002_cloud_data_schema_rls.sql`
3. `packages/db/sql/003_record_attachments_storage_rls.sql`

The second file creates:

- `public.vehicles`
- `public.vendors`
- `public.odometer_entries`
- `public.service_records`
- `public.repair_records`
- `public.maintenance_reminders`
- `public.record_attachments`

`vendors` is included as an optional cloud table because the intended database
model anticipates structured vendors. The current app UI still uses simple
`vendor_name` text on service and repair records, so `vendor_id` remains
optional.

The third file creates or updates a private Supabase Storage bucket:

- `record-attachments`

The bucket is not public. Files are stored under the authenticated user's UUID
as the first folder segment, for example:

- `{userId}/vehicles/{vehicleId}/service-records/{serviceRecordId}/{attachmentLocalId}-{fileName}`
- `{userId}/vehicles/{vehicleId}/repair-records/{repairRecordId}/{attachmentLocalId}-{fileName}`

## RLS Behavior

Every cloud data table has Row Level Security enabled.

Authenticated users can:

- select only rows where `user_id = auth.uid()`
- insert only rows where `user_id = auth.uid()`
- update only rows where `user_id = auth.uid()`
- delete only rows where `user_id = auth.uid()`

There is no public read access.

Child tables store both `user_id` and parent IDs. Composite foreign keys keep
child records tied to parent rows owned by the same user.

Storage policies on `storage.objects` allow authenticated users to select,
insert, update, and delete files only when `bucket_id = 'record-attachments'`
and the first folder segment equals `auth.uid()`. There is no public Storage
policy. The mobile app opens cloud attachments with short-lived signed URLs
instead of permanent public URLs.

## Manual Sanity Checks

After running the SQL, these dashboard queries should show RLS enabled:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
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

After running `003_record_attachments_storage_rls.sql`, this query should show
the bucket as private:

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'record-attachments';
```

This query should show the four owner-scoped Storage policies:

```sql
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'Record attachment files are %'
order by policyname;
```

This should show select, insert, update, and delete policies for each table:

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'vehicles',
    'vendors',
    'odometer_entries',
    'service_records',
    'repair_records',
    'maintenance_reminders',
    'record_attachments'
  )
order by tablename, policyname;
```

This should show the expected table names:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'vehicles',
    'vendors',
    'odometer_entries',
    'service_records',
    'repair_records',
    'maintenance_reminders',
    'record_attachments'
  )
order by table_name;
```

## TypeScript Types

This repo does not currently hand-maintain full generated Supabase database
types. Before broadening cloud sync beyond the current mobile vehicle,
odometer, service record, repair record, maintenance reminder, and service/repair
attachment slices, generate types from the live Supabase project with the
Supabase CLI and commit them in the database package or another agreed location.

## Still Deferred

- app-side cloud save/load beyond mobile vehicles, odometer entries, service records, repair records, maintenance reminders, and service/repair attachments
- guest-to-account migration
- upload of existing local guest data
- upload of existing local guest attachments
- cloud vendor CRUD
- vehicle-level cloud documents
- cloud CSV export
- cloud push notifications
- households, fuel tracking, VIN lookup, OCR, payments, PDF export, fleet tools,
  and shop/provider portals
