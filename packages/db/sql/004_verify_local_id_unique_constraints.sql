-- AutoLedger guest-to-account migration prerequisite verification.
--
-- Review/run this read-only query before enabling actual guest-to-account
-- migration. It confirms the cloud tables have unique constraints on
-- (user_id, local_id), which future migration uses to prevent duplicate rows.
--
-- This file does not change schema, does not weaken RLS, and does not migrate
-- data. If any row reports `missing`, add the missing unique constraint before
-- enabling upload migration.

with expected_constraints(table_name, constraint_name) as (
  values
    ('vehicles', 'vehicles_user_local_id_unique'),
    ('odometer_entries', 'odometer_entries_user_local_id_unique'),
    ('service_records', 'service_records_user_local_id_unique'),
    ('repair_records', 'repair_records_user_local_id_unique'),
    ('maintenance_reminders', 'maintenance_reminders_user_local_id_unique'),
    ('record_attachments', 'record_attachments_user_local_id_unique')
)
select
  expected_constraints.table_name,
  expected_constraints.constraint_name,
  case
    when table_constraints.constraint_name is null then 'missing'
    else 'present'
  end as status
from expected_constraints
left join information_schema.table_constraints
  on table_constraints.table_schema = 'public'
  and table_constraints.table_name = expected_constraints.table_name
  and table_constraints.constraint_name = expected_constraints.constraint_name
  and table_constraints.constraint_type = 'UNIQUE'
order by expected_constraints.table_name;
