-- AutoLedger live Supabase security verification.
--
-- Run this read-only script in the Supabase SQL editor after:
--   001_profiles_auth_foundation.sql
--   002_cloud_data_schema_rls.sql
--   003_record_attachments_storage_rls.sql
--   004_verify_local_id_unique_constraints.sql
--
-- Expected result: every critical row should report status = 'pass'.
-- Rows marked 'review' require manual inspection. Rows marked 'fail' should be
-- treated as launch blockers until fixed in the live Supabase project.
--
-- This script does not change schema, data, RLS, policies, or Storage config.

with
expected_tables(table_name, owner_column, expected_commands) as (
  values
    ('profiles', 'id', array['SELECT', 'INSERT', 'UPDATE']::text[]),
    ('vehicles', 'user_id', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]),
    ('vendors', 'user_id', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]),
    ('odometer_entries', 'user_id', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]),
    ('service_records', 'user_id', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]),
    ('repair_records', 'user_id', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]),
    ('maintenance_reminders', 'user_id', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]),
    ('record_attachments', 'user_id', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[])
),
expected_unique_constraints(table_name, constraint_name) as (
  values
    ('vehicles', 'vehicles_user_local_id_unique'),
    ('vendors', 'vendors_user_local_id_unique'),
    ('odometer_entries', 'odometer_entries_user_local_id_unique'),
    ('service_records', 'service_records_user_local_id_unique'),
    ('repair_records', 'repair_records_user_local_id_unique'),
    ('maintenance_reminders', 'maintenance_reminders_user_local_id_unique'),
    ('record_attachments', 'record_attachments_user_local_id_unique')
),
expected_foreign_keys(table_name, constraint_name) as (
  values
    ('profiles', 'profiles_id_fkey'),
    ('vehicles', 'vehicles_user_id_fkey'),
    ('vendors', 'vendors_user_id_fkey'),
    ('odometer_entries', 'odometer_entries_user_id_fkey'),
    ('odometer_entries', 'odometer_entries_vehicle_user_fk'),
    ('service_records', 'service_records_user_id_fkey'),
    ('service_records', 'service_records_vehicle_user_fk'),
    ('service_records', 'service_records_vendor_user_fk'),
    ('repair_records', 'repair_records_user_id_fkey'),
    ('repair_records', 'repair_records_vehicle_user_fk'),
    ('repair_records', 'repair_records_vendor_user_fk'),
    ('maintenance_reminders', 'maintenance_reminders_user_id_fkey'),
    ('maintenance_reminders', 'maintenance_reminders_vehicle_user_fk'),
    ('record_attachments', 'record_attachments_user_id_fkey'),
    ('record_attachments', 'record_attachments_vehicle_user_fk'),
    ('record_attachments', 'record_attachments_service_record_vehicle_user_fk'),
    ('record_attachments', 'record_attachments_repair_record_vehicle_user_fk')
),
expected_indexes(index_name) as (
  values
    ('vehicles_user_idx'),
    ('vehicles_user_archived_updated_idx'),
    ('vendors_user_idx'),
    ('vendors_user_name_idx'),
    ('odometer_entries_user_idx'),
    ('odometer_entries_vehicle_date_idx'),
    ('service_records_user_idx'),
    ('service_records_vehicle_date_idx'),
    ('service_records_vendor_idx'),
    ('repair_records_user_idx'),
    ('repair_records_vehicle_date_idx'),
    ('repair_records_vendor_idx'),
    ('maintenance_reminders_user_idx'),
    ('maintenance_reminders_vehicle_completed_due_idx'),
    ('maintenance_reminders_user_active_due_idx'),
    ('record_attachments_user_idx'),
    ('record_attachments_vehicle_idx'),
    ('record_attachments_service_record_idx'),
    ('record_attachments_repair_record_idx')
),
expected_storage_policies(policyname, cmd) as (
  values
    ('Record attachment files are viewable by owner', 'SELECT'),
    ('Record attachment files are insertable by owner', 'INSERT'),
    ('Record attachment files are updatable by owner', 'UPDATE'),
    ('Record attachment files are deletable by owner', 'DELETE')
),
table_policy_rows as (
  select
    policies.tablename,
    policies.policyname,
    policies.cmd,
    policies.roles,
    lower(coalesce(policies.qual, '') || ' ' || coalesce(policies.with_check, '')) as policy_expression
  from pg_policies policies
  where policies.schemaname = 'public'
),
storage_policy_rows as (
  select
    policies.policyname,
    policies.cmd,
    policies.roles,
    lower(coalesce(policies.qual, '') || ' ' || coalesce(policies.with_check, '')) as policy_expression
  from pg_policies policies
  where policies.schemaname = 'storage'
    and policies.tablename = 'objects'
),
checks as (
  select
    'public tables' as check_area,
    expected_tables.table_name as object_name,
    'table exists in public schema' as expectation,
    case when tables.table_name is null then 'missing' else 'present' end as actual,
    case when tables.table_name is null then 'fail' else 'pass' end as status,
    'Expected authenticated cloud table.' as details
  from expected_tables
  left join information_schema.tables tables
    on tables.table_schema = 'public'
    and tables.table_name = expected_tables.table_name

  union all

  select
    'rls enabled' as check_area,
    expected_tables.table_name as object_name,
    'rowsecurity = true' as expectation,
    coalesce(pg_tables.rowsecurity::text, 'missing table') as actual,
    case when pg_tables.rowsecurity then 'pass' else 'fail' end as status,
    'Every user-owned cloud table must have RLS enabled.' as details
  from expected_tables
  left join pg_tables
    on pg_tables.schemaname = 'public'
    and pg_tables.tablename = expected_tables.table_name

  union all

  select
    'table grants' as check_area,
    expected_tables.table_name || ':' || privilege.privilege_type as object_name,
    'authenticated table privilege exists' as expectation,
    coalesce(table_grants.privilege_type, 'missing') as actual,
    case when table_grants.privilege_type is null then 'fail' else 'pass' end as status,
    'Table grants are required before RLS policies can evaluate owner rows.' as details
  from expected_tables
  cross join lateral unnest(expected_tables.expected_commands) as privilege(privilege_type)
  left join information_schema.role_table_grants table_grants
    on table_grants.table_schema = 'public'
    and table_grants.table_name = expected_tables.table_name
    and table_grants.grantee = 'authenticated'
    and table_grants.privilege_type = privilege.privilege_type

  union all

  select
    'anon/public table grants' as check_area,
    'public schema AutoLedger tables' as object_name,
    'no anon/public table privileges' as expectation,
    count(*)::text || ' suspicious grants' as actual,
    case when count(*) = 0 then 'pass' else 'fail' end as status,
    'AutoLedger cloud tables should not grant direct table access to anon/public.' as details
  from information_schema.role_table_grants table_grants
  join expected_tables
    on expected_tables.table_name = table_grants.table_name
  where table_grants.table_schema = 'public'
    and table_grants.grantee in ('anon', 'PUBLIC')

  union all

  select
    'rls policy commands' as check_area,
    expected_tables.table_name || ':' || command.command_name as object_name,
    'authenticated owner policy for command exists' as expectation,
    coalesce(policy.policyname, 'missing') as actual,
    case when policy.policyname is null then 'fail' else 'pass' end as status,
    'Expected one owner-scoped policy for this command.' as details
  from expected_tables
  cross join lateral unnest(expected_tables.expected_commands) as command(command_name)
  left join table_policy_rows policy
    on policy.tablename = expected_tables.table_name
    and policy.cmd = command.command_name
    and 'authenticated' = any(policy.roles)

  union all

  select
    'rls policy owner predicate' as check_area,
    expected_tables.table_name || ':' || policy.cmd as object_name,
    'policy expression references auth.uid() and owner column' as expectation,
    policy.policyname as actual,
    case
      when policy.policy_expression like '%auth.uid%'
        and policy.policy_expression like '%' || expected_tables.owner_column || '%'
      then 'pass'
      else 'review'
    end as status,
    'Review policy SQL manually when this is review; catalog text can vary.' as details
  from expected_tables
  join table_policy_rows policy
    on policy.tablename = expected_tables.table_name
    and 'authenticated' = any(policy.roles)

  union all

  select
    'public/anon table policies' as check_area,
    'public schema AutoLedger tables' as object_name,
    'no anon/public policies' as expectation,
    count(*)::text || ' suspicious policies' as actual,
    case when count(*) = 0 then 'pass' else 'fail' end as status,
    'No AutoLedger public table should grant anon/public access.' as details
  from table_policy_rows policy
  join expected_tables
    on expected_tables.table_name = policy.tablename
  where 'anon' = any(policy.roles)
    or 'public' = any(policy.roles)

  union all

  select
    'unique constraints' as check_area,
    expected_unique_constraints.table_name || ':' || expected_unique_constraints.constraint_name as object_name,
    'unique (user_id, local_id)' as expectation,
    coalesce(table_constraints.constraint_name, 'missing') as actual,
    case when table_constraints.constraint_name is null then 'fail' else 'pass' end as status,
    'Required for idempotent guest-to-account migration duplicate prevention.' as details
  from expected_unique_constraints
  left join information_schema.table_constraints table_constraints
    on table_constraints.table_schema = 'public'
    and table_constraints.table_name = expected_unique_constraints.table_name
    and table_constraints.constraint_name = expected_unique_constraints.constraint_name
    and table_constraints.constraint_type = 'UNIQUE'

  union all

  select
    'foreign keys' as check_area,
    expected_foreign_keys.table_name || ':' || expected_foreign_keys.constraint_name as object_name,
    'expected foreign key exists' as expectation,
    coalesce(table_constraints.constraint_name, 'missing') as actual,
    case when table_constraints.constraint_name is null then 'fail' else 'pass' end as status,
    'Owner-scoped child-table foreign keys prevent cross-user parent linking.' as details
  from expected_foreign_keys
  left join information_schema.table_constraints table_constraints
    on table_constraints.table_schema = 'public'
    and table_constraints.table_name = expected_foreign_keys.table_name
    and table_constraints.constraint_name = expected_foreign_keys.constraint_name
    and table_constraints.constraint_type = 'FOREIGN KEY'

  union all

  select
    'indexes' as check_area,
    expected_indexes.index_name as object_name,
    'expected operational index exists' as expectation,
    coalesce(pg_indexes.indexname, 'missing') as actual,
    case when pg_indexes.indexname is null then 'review' else 'pass' end as status,
    'Missing indexes are performance risks, not direct RLS failures.' as details
  from expected_indexes
  left join pg_indexes
    on pg_indexes.schemaname = 'public'
    and pg_indexes.indexname = expected_indexes.index_name

  union all

  select
    'storage bucket' as check_area,
    'record-attachments' as object_name,
    'bucket exists' as expectation,
    case when buckets.id is null then 'missing' else 'present' end as actual,
    case when buckets.id is null then 'fail' else 'pass' end as status,
    'Cloud service/repair attachments use this private bucket.' as details
  from (select 1) singleton
  left join storage.buckets buckets
    on buckets.id = 'record-attachments'

  union all

  select
    'storage bucket privacy' as check_area,
    'record-attachments' as object_name,
    'public = false' as expectation,
    coalesce(buckets.public::text, 'missing bucket') as actual,
    case when buckets.public = false then 'pass' else 'fail' end as status,
    'Do not make AutoLedger attachment buckets public.' as details
  from (select 1) singleton
  left join storage.buckets buckets
    on buckets.id = 'record-attachments'

  union all

  select
    'storage bucket limits' as check_area,
    'record-attachments' as object_name,
    '25 MB limit and expected MIME types' as expectation,
    coalesce(buckets.file_size_limit::text, 'missing bucket') as actual,
    case
      when buckets.file_size_limit = 26214400
        and buckets.allowed_mime_types @> array[
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'application/pdf'
        ]::text[]
      then 'pass'
      else 'review'
    end as status,
    'Review allowed_mime_types if this reports review.' as details
  from (select 1) singleton
  left join storage.buckets buckets
    on buckets.id = 'record-attachments'

  union all

  select
    'storage policies' as check_area,
    expected_storage_policies.policyname || ':' || expected_storage_policies.cmd as object_name,
    'authenticated owner-scoped storage policy exists' as expectation,
    coalesce(policy.policyname, 'missing') as actual,
    case when policy.policyname is null then 'fail' else 'pass' end as status,
    'Expected policy on storage.objects for private attachment files.' as details
  from expected_storage_policies
  left join storage_policy_rows policy
    on policy.policyname = expected_storage_policies.policyname
    and policy.cmd = expected_storage_policies.cmd
    and 'authenticated' = any(policy.roles)

  union all

  select
    'storage policy predicate' as check_area,
    policy.policyname || ':' || policy.cmd as object_name,
    'policy references bucket and auth.uid()' as expectation,
    policy.policyname as actual,
    case
      when policy.policy_expression like '%record-attachments%'
        and policy.policy_expression like '%auth.uid%'
      then 'pass'
      else 'review'
    end as status,
    'Storage policy should restrict the first path segment to auth.uid().' as details
  from storage_policy_rows policy
  join expected_storage_policies expected
    on expected.policyname = policy.policyname
    and expected.cmd = policy.cmd
  where 'authenticated' = any(policy.roles)

  union all

  select
    'public/anon storage policies' as check_area,
    'storage.objects record-attachments' as object_name,
    'no anon/public record-attachments policies' as expectation,
    count(*)::text || ' suspicious policies' as actual,
    case when count(*) = 0 then 'pass' else 'fail' end as status,
    'No Storage policy should expose private attachments to anon/public.' as details
  from storage_policy_rows policy
  where policy.policy_expression like '%record-attachments%'
    and (
      'anon' = any(policy.roles)
      or 'public' = any(policy.roles)
    )
)
select
  check_area,
  object_name,
  expectation,
  actual,
  status,
  details
from checks
order by
  case status
    when 'fail' then 0
    when 'review' then 1
    else 2
  end,
  check_area,
  object_name;
