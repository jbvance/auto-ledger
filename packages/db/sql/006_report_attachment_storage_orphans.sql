-- AutoLedger read-only attachment Storage orphan report.
--
-- Run this in the Supabase SQL editor when investigating cloud attachment
-- partial failures. It does not change data, policies, buckets, or objects.
--
-- Expected result:
-- - zero metadata_missing_storage rows
-- - zero storage_missing_metadata rows
--
-- Notes:
-- - This compares public.record_attachments.storage_path with storage.objects.
-- - Run from a trusted admin SQL context. Do not make the bucket public to
--   investigate private attachments.

with attachment_metadata as (
  select
    id as attachment_id,
    user_id,
    vehicle_id,
    service_record_id,
    repair_record_id,
    file_name,
    storage_bucket,
    storage_path,
    created_at,
    updated_at
  from public.record_attachments
  where storage_bucket = 'record-attachments'
    and storage_path is not null
),
attachment_objects as (
  select
    bucket_id,
    name as storage_path,
    owner,
    created_at,
    updated_at
  from storage.objects
  where bucket_id = 'record-attachments'
),
metadata_missing_storage as (
  select
    'metadata_missing_storage' as issue_type,
    metadata.user_id,
    metadata.attachment_id,
    metadata.vehicle_id,
    metadata.service_record_id,
    metadata.repair_record_id,
    metadata.file_name,
    metadata.storage_bucket,
    metadata.storage_path,
    metadata.created_at as metadata_created_at,
    metadata.updated_at as metadata_updated_at,
    null::uuid as storage_owner,
    null::timestamptz as object_created_at,
    null::timestamptz as object_updated_at
  from attachment_metadata metadata
  left join attachment_objects object
    on object.bucket_id = metadata.storage_bucket
    and object.storage_path = metadata.storage_path
  where object.storage_path is null
),
storage_missing_metadata as (
  select
    'storage_missing_metadata' as issue_type,
    null::uuid as user_id,
    null::uuid as attachment_id,
    null::uuid as vehicle_id,
    null::uuid as service_record_id,
    null::uuid as repair_record_id,
    null::text as file_name,
    object.bucket_id as storage_bucket,
    object.storage_path,
    null::timestamptz as metadata_created_at,
    null::timestamptz as metadata_updated_at,
    object.owner as storage_owner,
    object.created_at as object_created_at,
    object.updated_at as object_updated_at
  from attachment_objects object
  left join attachment_metadata metadata
    on metadata.storage_bucket = object.bucket_id
    and metadata.storage_path = object.storage_path
  where metadata.storage_path is null
)
select *
from metadata_missing_storage
union all
select *
from storage_missing_metadata
order by issue_type, storage_path;
