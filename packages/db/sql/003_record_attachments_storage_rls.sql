-- AutoLedger private Supabase Storage setup for cloud record attachments.
-- Run this after 001_profiles_auth_foundation.sql and 002_cloud_data_schema_rls.sql.
--
-- This creates a private bucket for service/repair record attachment files and
-- Storage RLS policies scoped to the first folder segment, which must be the
-- authenticated user's UUID. It does not add public read access and does not
-- require a service role key in mobile/browser code.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'record-attachments',
  'record-attachments',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Record attachment files are viewable by owner"
  on storage.objects;
create policy "Record attachment files are viewable by owner"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'record-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Record attachment files are insertable by owner"
  on storage.objects;
create policy "Record attachment files are insertable by owner"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'record-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Record attachment files are updatable by owner"
  on storage.objects;
create policy "Record attachment files are updatable by owner"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'record-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'record-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Record attachment files are deletable by owner"
  on storage.objects;
create policy "Record attachment files are deletable by owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'record-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
