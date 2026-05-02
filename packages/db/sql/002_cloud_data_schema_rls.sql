-- AutoLedger cloud data schema and RLS foundation.
-- Run this after 001_profiles_auth_foundation.sql.
--
-- This creates authenticated cloud tables only. It does not implement app sync,
-- guest-to-account migration, Supabase Storage, OCR, or cloud notifications.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  local_id text not null default gen_random_uuid()::text,
  nickname text not null check (length(btrim(nickname)) > 0),
  make text not null check (length(btrim(make)) > 0),
  model text not null check (length(btrim(model)) > 0),
  year integer not null check (year >= 1886 and year <= 3000),
  trim text,
  vin text,
  license_plate text,
  license_state text,
  color text,
  vehicle_type text not null check (
    vehicle_type in (
      'car',
      'suv',
      'truck',
      'van',
      'motorcycle',
      'rv',
      'trailer',
      'other'
    )
  ),
  initial_odometer integer not null default 0 check (initial_odometer >= 0),
  current_odometer integer not null check (current_odometer >= 0),
  odometer_unit text not null check (odometer_unit in ('mi', 'km')),
  purchase_date date,
  purchase_odometer integer check (purchase_odometer is null or purchase_odometer >= 0),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (
    sync_status in ('local_only', 'pending_upload', 'synced', 'sync_error')
  ),
  constraint vehicles_purchase_odometer_not_above_current
    check (purchase_odometer is null or purchase_odometer <= current_odometer),
  constraint vehicles_initial_odometer_not_above_current
    check (initial_odometer <= current_odometer),
  constraint vehicles_user_local_id_unique unique (user_id, local_id),
  constraint vehicles_id_user_unique unique (id, user_id)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  local_id text not null default gen_random_uuid()::text,
  name text not null check (length(btrim(name)) > 0),
  phone text,
  email text,
  website text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (
    sync_status in ('local_only', 'pending_upload', 'synced', 'sync_error')
  ),
  constraint vendors_user_local_id_unique unique (user_id, local_id),
  constraint vendors_id_user_unique unique (id, user_id)
);

create table if not exists public.odometer_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  vehicle_id uuid not null,
  local_id text not null default gen_random_uuid()::text,
  reading integer not null check (reading >= 0),
  reading_date date not null,
  odometer_unit text not null check (odometer_unit in ('mi', 'km')),
  source_type text not null check (
    source_type in (
      'manual',
      'service_record',
      'repair_record',
      'reminder_completion',
      'import'
    )
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (
    sync_status in ('local_only', 'pending_upload', 'synced', 'sync_error')
  ),
  constraint odometer_entries_vehicle_user_fk
    foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id)
    on update restrict
    on delete restrict,
  constraint odometer_entries_user_local_id_unique unique (user_id, local_id),
  constraint odometer_entries_id_user_unique unique (id, user_id)
);

create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  vehicle_id uuid not null,
  local_id text not null default gen_random_uuid()::text,
  service_date date not null,
  odometer_reading integer check (odometer_reading is null or odometer_reading >= 0),
  title text not null check (length(btrim(title)) > 0),
  category text not null check (
    category in (
      'oil_change',
      'tire_rotation',
      'inspection',
      'registration',
      'brakes',
      'battery',
      'fluids',
      'scheduled_maintenance',
      'tires',
      'other'
    )
  ),
  description text,
  vendor_id uuid,
  vendor_name text,
  cost_amount numeric(12, 2) check (cost_amount is null or cost_amount >= 0),
  cost_currency text not null default 'USD' check (cost_currency ~ '^[A-Z]{3}$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (
    sync_status in ('local_only', 'pending_upload', 'synced', 'sync_error')
  ),
  constraint service_records_vehicle_user_fk
    foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id)
    on update restrict
    on delete restrict,
  constraint service_records_vendor_user_fk
    foreign key (vendor_id, user_id)
    references public.vendors (id, user_id)
    on update restrict
    on delete restrict,
  constraint service_records_user_local_id_unique unique (user_id, local_id),
  constraint service_records_id_user_unique unique (id, user_id),
  constraint service_records_id_vehicle_user_unique unique (id, vehicle_id, user_id)
);

create table if not exists public.repair_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  vehicle_id uuid not null,
  local_id text not null default gen_random_uuid()::text,
  repair_date date not null,
  odometer_reading integer check (odometer_reading is null or odometer_reading >= 0),
  title text not null check (length(btrim(title)) > 0),
  category text not null check (
    category in (
      'engine',
      'transmission',
      'electrical',
      'brakes',
      'suspension',
      'body',
      'tires',
      'hvac',
      'diagnostic',
      'other'
    )
  ),
  description text,
  vendor_id uuid,
  vendor_name text,
  cost_amount numeric(12, 2) check (cost_amount is null or cost_amount >= 0),
  cost_currency text not null default 'USD' check (cost_currency ~ '^[A-Z]{3}$'),
  warranty_until_date date,
  warranty_until_odometer integer check (
    warranty_until_odometer is null or warranty_until_odometer >= 0
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (
    sync_status in ('local_only', 'pending_upload', 'synced', 'sync_error')
  ),
  constraint repair_records_vehicle_user_fk
    foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id)
    on update restrict
    on delete restrict,
  constraint repair_records_vendor_user_fk
    foreign key (vendor_id, user_id)
    references public.vendors (id, user_id)
    on update restrict
    on delete restrict,
  constraint repair_records_user_local_id_unique unique (user_id, local_id),
  constraint repair_records_id_user_unique unique (id, user_id),
  constraint repair_records_id_vehicle_user_unique unique (id, vehicle_id, user_id)
);

create table if not exists public.maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  vehicle_id uuid not null,
  local_id text not null default gen_random_uuid()::text,
  title text not null check (length(btrim(title)) > 0),
  category text not null check (
    category in (
      'oil_change',
      'tire_rotation',
      'inspection',
      'registration',
      'insurance',
      'warranty',
      'battery',
      'brakes',
      'custom'
    )
  ),
  reminder_type text not null check (
    reminder_type in ('date', 'mileage', 'date_or_mileage')
  ),
  due_date date,
  due_odometer integer check (due_odometer is null or due_odometer >= 0),
  repeat_interval_months integer check (
    repeat_interval_months is null or repeat_interval_months >= 0
  ),
  repeat_interval_miles integer check (
    repeat_interval_miles is null or repeat_interval_miles >= 0
  ),
  is_completed boolean not null default false,
  completed_at timestamptz,
  last_triggered_at timestamptz,
  notes text,
  scheduled_notification_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (
    sync_status in ('local_only', 'pending_upload', 'synced', 'sync_error')
  ),
  constraint maintenance_reminders_vehicle_user_fk
    foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id)
    on update restrict
    on delete restrict,
  constraint maintenance_reminders_due_fields_match_type check (
    (reminder_type = 'date' and due_date is not null)
    or (reminder_type = 'mileage' and due_odometer is not null)
    or (
      reminder_type = 'date_or_mileage'
      and (due_date is not null or due_odometer is not null)
    )
  ),
  constraint maintenance_reminders_completed_at_matches_state check (
    (is_completed = false and completed_at is null)
    or is_completed = true
  ),
  constraint maintenance_reminders_user_local_id_unique unique (user_id, local_id),
  constraint maintenance_reminders_id_user_unique unique (id, user_id)
);

create table if not exists public.record_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  vehicle_id uuid not null,
  service_record_id uuid,
  repair_record_id uuid,
  local_id text not null default gen_random_uuid()::text,
  file_name text not null check (length(btrim(file_name)) > 0),
  file_type text not null check (file_type in ('photo', 'pdf')),
  mime_type text not null check (length(btrim(mime_type)) > 0),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  storage_bucket text,
  storage_path text,
  local_uri text,
  ocr_status text not null default 'not_started' check (
    ocr_status in ('not_started', 'pending', 'processed', 'failed')
  ),
  ocr_text text,
  ocr_vendor text,
  ocr_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (
    sync_status in ('local_only', 'pending_upload', 'synced', 'sync_error')
  ),
  constraint record_attachments_vehicle_user_fk
    foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id)
    on update restrict
    on delete restrict,
  constraint record_attachments_service_record_vehicle_user_fk
    foreign key (service_record_id, vehicle_id, user_id)
    references public.service_records (id, vehicle_id, user_id)
    on update restrict
    on delete restrict,
  constraint record_attachments_repair_record_vehicle_user_fk
    foreign key (repair_record_id, vehicle_id, user_id)
    references public.repair_records (id, vehicle_id, user_id)
    on update restrict
    on delete restrict,
  constraint record_attachments_one_record_fk check (
    (service_record_id is not null and repair_record_id is null)
    or (service_record_id is null and repair_record_id is not null)
  ),
  constraint record_attachments_file_type_mime_type check (
    (file_type = 'photo' and mime_type like 'image/%')
    or (file_type = 'pdf' and mime_type = 'application/pdf')
  ),
  constraint record_attachments_user_local_id_unique unique (user_id, local_id),
  constraint record_attachments_id_user_unique unique (id, user_id)
);

comment on column public.maintenance_reminders.scheduled_notification_id is
  'Local device notification identifier kept for local schema parity. Cloud push notifications are not implemented.';

create index if not exists vehicles_user_idx
  on public.vehicles (user_id);
create index if not exists vehicles_user_archived_updated_idx
  on public.vehicles (user_id, archived_at, updated_at desc);

create index if not exists vendors_user_idx
  on public.vendors (user_id);
create index if not exists vendors_user_name_idx
  on public.vendors (user_id, name);

create index if not exists odometer_entries_user_idx
  on public.odometer_entries (user_id);
create index if not exists odometer_entries_vehicle_date_idx
  on public.odometer_entries (vehicle_id, reading_date desc, created_at desc);

create index if not exists service_records_user_idx
  on public.service_records (user_id);
create index if not exists service_records_vehicle_date_idx
  on public.service_records (vehicle_id, service_date desc, created_at desc);
create index if not exists service_records_vendor_idx
  on public.service_records (vendor_id)
  where vendor_id is not null;

create index if not exists repair_records_user_idx
  on public.repair_records (user_id);
create index if not exists repair_records_vehicle_date_idx
  on public.repair_records (vehicle_id, repair_date desc, created_at desc);
create index if not exists repair_records_vendor_idx
  on public.repair_records (vendor_id)
  where vendor_id is not null;

create index if not exists maintenance_reminders_user_idx
  on public.maintenance_reminders (user_id);
create index if not exists maintenance_reminders_vehicle_completed_due_idx
  on public.maintenance_reminders (
    vehicle_id,
    is_completed,
    due_date,
    due_odometer
  );
create index if not exists maintenance_reminders_user_active_due_idx
  on public.maintenance_reminders (user_id, is_completed, due_date, due_odometer);

create index if not exists record_attachments_user_idx
  on public.record_attachments (user_id);
create index if not exists record_attachments_vehicle_idx
  on public.record_attachments (vehicle_id, created_at desc);
create index if not exists record_attachments_service_record_idx
  on public.record_attachments (service_record_id, created_at desc)
  where service_record_id is not null;
create index if not exists record_attachments_repair_record_idx
  on public.record_attachments (repair_record_id, created_at desc)
  where repair_record_id is not null;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row
  execute function public.set_updated_at();

drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row
  execute function public.set_updated_at();

drop trigger if exists odometer_entries_set_updated_at on public.odometer_entries;
create trigger odometer_entries_set_updated_at
  before update on public.odometer_entries
  for each row
  execute function public.set_updated_at();

drop trigger if exists service_records_set_updated_at on public.service_records;
create trigger service_records_set_updated_at
  before update on public.service_records
  for each row
  execute function public.set_updated_at();

drop trigger if exists repair_records_set_updated_at on public.repair_records;
create trigger repair_records_set_updated_at
  before update on public.repair_records
  for each row
  execute function public.set_updated_at();

drop trigger if exists maintenance_reminders_set_updated_at
  on public.maintenance_reminders;
create trigger maintenance_reminders_set_updated_at
  before update on public.maintenance_reminders
  for each row
  execute function public.set_updated_at();

drop trigger if exists record_attachments_set_updated_at
  on public.record_attachments;
create trigger record_attachments_set_updated_at
  before update on public.record_attachments
  for each row
  execute function public.set_updated_at();

alter table public.vehicles enable row level security;
alter table public.vendors enable row level security;
alter table public.odometer_entries enable row level security;
alter table public.service_records enable row level security;
alter table public.repair_records enable row level security;
alter table public.maintenance_reminders enable row level security;
alter table public.record_attachments enable row level security;

drop policy if exists "Vehicles are viewable by owner" on public.vehicles;
create policy "Vehicles are viewable by owner"
  on public.vehicles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Vehicles are insertable by owner" on public.vehicles;
create policy "Vehicles are insertable by owner"
  on public.vehicles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Vehicles are updatable by owner" on public.vehicles;
create policy "Vehicles are updatable by owner"
  on public.vehicles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Vehicles are deletable by owner" on public.vehicles;
create policy "Vehicles are deletable by owner"
  on public.vehicles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Vendors are viewable by owner" on public.vendors;
create policy "Vendors are viewable by owner"
  on public.vendors
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Vendors are insertable by owner" on public.vendors;
create policy "Vendors are insertable by owner"
  on public.vendors
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Vendors are updatable by owner" on public.vendors;
create policy "Vendors are updatable by owner"
  on public.vendors
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Vendors are deletable by owner" on public.vendors;
create policy "Vendors are deletable by owner"
  on public.vendors
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Odometer entries are viewable by owner"
  on public.odometer_entries;
create policy "Odometer entries are viewable by owner"
  on public.odometer_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Odometer entries are insertable by owner"
  on public.odometer_entries;
create policy "Odometer entries are insertable by owner"
  on public.odometer_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Odometer entries are updatable by owner"
  on public.odometer_entries;
create policy "Odometer entries are updatable by owner"
  on public.odometer_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Odometer entries are deletable by owner"
  on public.odometer_entries;
create policy "Odometer entries are deletable by owner"
  on public.odometer_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service records are viewable by owner"
  on public.service_records;
create policy "Service records are viewable by owner"
  on public.service_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service records are insertable by owner"
  on public.service_records;
create policy "Service records are insertable by owner"
  on public.service_records
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Service records are updatable by owner"
  on public.service_records;
create policy "Service records are updatable by owner"
  on public.service_records
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Service records are deletable by owner"
  on public.service_records;
create policy "Service records are deletable by owner"
  on public.service_records
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Repair records are viewable by owner"
  on public.repair_records;
create policy "Repair records are viewable by owner"
  on public.repair_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Repair records are insertable by owner"
  on public.repair_records;
create policy "Repair records are insertable by owner"
  on public.repair_records
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Repair records are updatable by owner"
  on public.repair_records;
create policy "Repair records are updatable by owner"
  on public.repair_records
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Repair records are deletable by owner"
  on public.repair_records;
create policy "Repair records are deletable by owner"
  on public.repair_records
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Maintenance reminders are viewable by owner"
  on public.maintenance_reminders;
create policy "Maintenance reminders are viewable by owner"
  on public.maintenance_reminders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Maintenance reminders are insertable by owner"
  on public.maintenance_reminders;
create policy "Maintenance reminders are insertable by owner"
  on public.maintenance_reminders
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Maintenance reminders are updatable by owner"
  on public.maintenance_reminders;
create policy "Maintenance reminders are updatable by owner"
  on public.maintenance_reminders
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Maintenance reminders are deletable by owner"
  on public.maintenance_reminders;
create policy "Maintenance reminders are deletable by owner"
  on public.maintenance_reminders
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Record attachments are viewable by owner"
  on public.record_attachments;
create policy "Record attachments are viewable by owner"
  on public.record_attachments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Record attachments are insertable by owner"
  on public.record_attachments;
create policy "Record attachments are insertable by owner"
  on public.record_attachments
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Record attachments are updatable by owner"
  on public.record_attachments;
create policy "Record attachments are updatable by owner"
  on public.record_attachments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Record attachments are deletable by owner"
  on public.record_attachments;
create policy "Record attachments are deletable by owner"
  on public.record_attachments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
