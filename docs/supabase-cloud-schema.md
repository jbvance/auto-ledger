# Supabase Cloud Schema Setup

This document covers the current cloud data schema foundation for AutoLedger.

The SQL in this slice creates authenticated cloud tables and Row Level Security
policies. Mobile cloud vehicle CRUD, mobile cloud odometer entry CRUD, and
mobile cloud service record CRUD are implemented against these tables. The app
does not yet implement cloud repair, reminder, attachment, or vendor CRUD,
guest-to-account migration, Supabase Storage uploads, cloud attachment access,
OCR, or cloud push notifications.

## SQL Files

Run these files in order in the Supabase dashboard SQL editor:

1. `packages/db/sql/001_profiles_auth_foundation.sql`
2. `packages/db/sql/002_cloud_data_schema_rls.sql`

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
odometer, and service record slices, generate types from the live Supabase
project with the Supabase CLI and commit them in the database package or another
agreed location.

## Still Deferred

- app-side cloud save/load beyond mobile vehicles, odometer entries, and service records
- guest-to-account migration
- upload of existing local guest data
- cloud repair, reminder, vendor, and attachment metadata CRUD
- Supabase Storage buckets and private attachment paths
- cloud attachment sync
- cloud push notifications
- households, fuel tracking, VIN lookup, OCR, payments, PDF export, fleet tools,
  and shop/provider portals
