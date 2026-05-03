# Guest-to-Account Migration Readiness Plan

This document audits the current repo readiness for migrating local guest data
to an authenticated Supabase account. Slice 1 readiness/status detection,
Slice 2 vehicle-only migration, and Slice 3 odometer-entry-only migration are
now implemented locally. Full migration is not implemented yet: service
records, repair records, maintenance reminders, and attachments are still
deferred. Vehicle and odometer migration do not delete local data.

## 1. Current Readiness Summary

The repo is ready for vehicle-only and odometer-entry-only migration and mostly
ready at the data model level for later child-record slices. It is not yet ready
for full guest-to-account migration.

Ready:

- Local guest SQLite tables exist for vehicles, odometer entries, service
  records, repair records, maintenance reminders, and record attachments in
  `apps/mobile/lib/database.ts`.
- Local records consistently include `id`, `local_id`, timestamps, and
  `sync_status`. Current local creation sets `id` and `local_id` to the same
  generated text value.
- Local collection helpers already exist for all migration source entities.
  `apps/mobile/lib/localCsvExport.ts` is a useful reference because it already
  collects active and archived vehicles plus their child records and attachment
  metadata.
- `apps/mobile/lib/localGuestData.ts` can detect whether any local guest data
  exists after sign-in or sign-up.
- `apps/mobile/lib/guestMigration.ts` can summarize local guest data for a
  future migration review without mutating guest records.
- Local-only `migration_runs` and `migration_entity_mappings` SQLite tables now
  exist for future migration status and ID mapping.
- Signed-in users with local guest data now see non-destructive sign-in/sign-up
  notices and a Settings readiness section with active vehicle-only and
  odometer-entry-only migration actions.
- `apps/mobile/lib/guestVehicleMigration.ts` migrates local guest vehicles only,
  preserves local `local_id`, includes archived vehicles, preserves
  `archived_at`, and writes vehicle mapping rows.
- Vehicle-only migration uses select-by-`user_id`-and-`local_id` before insert
  and repairs missing mapping rows if the cloud vehicle already exists.
- `apps/mobile/lib/guestOdometerMigration.ts` migrates local guest odometer
  entries only after vehicle mappings exist, preserves local odometer
  `local_id`, maps local vehicles to cloud vehicle UUIDs through
  `migration_entity_mappings`, writes `entity_type = 'odometer_entry'`
  mappings, and skips entries whose vehicle mapping is missing.
- Odometer-only migration uses select-by-`user_id`-and-`local_id` before insert
  and repairs missing mapping rows if the cloud odometer entry already exists.
- Affected cloud vehicle odometers are recalculated after odometer-only
  migration, using cloud rows only.
- Supabase cloud tables exist in `packages/db/sql/002_cloud_data_schema_rls.sql`
  for all target entities, including `local_id`, `sync_status`, owner-scoped
  foreign keys, and `unique (user_id, local_id)` constraints.
- Cloud attachment Storage setup exists in
  `packages/db/sql/003_record_attachments_storage_rls.sql` with a private
  `record-attachments` bucket and user-scoped Storage RLS.
- Shared TypeScript types and Zod validation schemas exist for all records in
  `packages/shared/src/index.ts` and `packages/validation/src/index.ts`.

Not ready:

- Existing cloud CRUD helpers generate new cloud-only `local_id` values such as
  `cloud_...`, `cloud_odo_...`, and `cloud_att_...`. Migration must preserve the
  original local `local_id`, so it should use dedicated migration helpers.
- Existing cloud create helpers accept form input types, not complete local rows.
  They do not preserve local `created_at`, `updated_at`, `archived_at`,
  `completed_at`, `last_triggered_at`, or attachment OCR metadata.
- Existing cloud create helpers for service, repair, reminder, and attachment
  records generate new cloud-only local IDs and are not migration-safe. Later
  migration slices should use dedicated helpers that preserve local IDs.
- The durable local status/mapping tables exist. Vehicle-only migration writes
  completed vehicle cloud UUID mappings, and odometer-only migration writes
  completed or skipped odometer mappings. Service, repair, reminder, and
  attachment mappings are not written yet.
- There is no full migration prompt/progress UI and no service/repair/reminder
  or attachment upload/retry workflow yet. The current Settings actions are
  intentionally scoped to vehicles and odometer entries.
- Cloud attachment upload currently uses a generated attachment local ID and
  `upsert: false`, so it is not idempotent for retrying migrated local
  attachments.
- Local notification IDs should remain local-only. Cloud reminders currently
  include `scheduled_notification_id` for parity, but migration should set it to
  null or omit it for cloud rows.

## 2. Data Mapping Table

| Local table/entity | Cloud table/entity | Key fields | Relationship dependencies | Migration order |
| --- | --- | --- | --- | --- |
| `vehicles` / `Vehicle` | `public.vehicles` / `Vehicle` | `local_id`, `nickname`, `make`, `model`, `year`, `vehicle_type`, `initial_odometer`, `current_odometer`, `odometer_unit`, `purchase_*`, `archived_at`, timestamps, `sync_status` | Root entity. Child rows depend on local vehicle ID mapping to cloud vehicle UUID. | 1 |
| `odometer_entries` / `OdometerEntry` | `public.odometer_entries` / `OdometerEntry` | `local_id`, `vehicle_id`, `reading`, `reading_date`, `odometer_unit`, `source_type`, `notes`, timestamps, `sync_status` | Requires local vehicle ID to cloud vehicle UUID map. Odometer unit must match parent vehicle. | 2 |
| `service_records` / `ServiceRecord` | `public.service_records` / `ServiceRecord` | `local_id`, `vehicle_id`, `service_date`, `odometer_reading`, `title`, `category`, `description`, `vendor_name`, `cost_*`, `notes`, timestamps, `sync_status` | Requires local vehicle ID to cloud vehicle UUID map. Attachments depend on service record mapping. | 3 |
| `repair_records` / `RepairRecord` | `public.repair_records` / `RepairRecord` | `local_id`, `vehicle_id`, `repair_date`, `odometer_reading`, `title`, `category`, `description`, `vendor_name`, `cost_*`, `warranty_*`, `notes`, timestamps, `sync_status` | Requires local vehicle ID to cloud vehicle UUID map. Attachments depend on repair record mapping. | 4 |
| `maintenance_reminders` / `MaintenanceReminder` | `public.maintenance_reminders` / `MaintenanceReminder` | `local_id`, `vehicle_id`, `title`, `category`, `reminder_type`, `due_date`, `due_odometer`, `repeat_interval_*`, `is_completed`, `completed_at`, `last_triggered_at`, `notes`, timestamps, `sync_status` | Requires local vehicle ID to cloud vehicle UUID map. Local `scheduled_notification_id` should not be copied. | 5 |
| `record_attachments` / `RecordAttachment` | Supabase Storage file plus `public.record_attachments` metadata | `local_id`, `vehicle_id`, `service_record_id` or `repair_record_id`, `file_name`, `file_type`, `mime_type`, `file_size_bytes`, `storage_bucket`, `storage_path`, OCR fields, timestamps, `sync_status` | Requires local vehicle ID mapping and service/repair parent record mapping. File upload must succeed or be reported separately from metadata migration. | 6 |

## 3. Recommended Migration Order

1. Vehicles first, including archived vehicles.
2. Odometer entries.
3. Service records.
4. Repair records.
5. Maintenance reminders.
6. Attachment metadata and files last.

This order satisfies all foreign-key dependencies and gives attachment
migration the cloud vehicle UUID and cloud service/repair record UUIDs needed to
construct Storage paths.

## 4. ID Mapping Strategy

Use the local `local_id` as the stable migration key. For current guest records,
`id` and `local_id` are the same value, but migration should read and preserve
`local_id` explicitly.

Recommended approach:

- Create a local migration map, either as one SQLite table or as per-entity
  `cloud_id` fields. A single table is more flexible:

  ```text
  guest_migration_mappings
  - id
  - user_id
  - entity_type
  - local_id
  - cloud_id
  - status
  - error_message
  - created_at
  - updated_at
  ```

- Insert or upsert cloud rows with `local_id = local.local_id`.
- Use Supabase `upsert(..., { onConflict: "user_id,local_id" })` or an
  equivalent select-then-insert fallback.
- Read back each cloud row's UUID and store it in the local mapping table.
- Build these maps before migrating dependent rows:
  - `localVehicleId/localVehicleLocalId -> cloudVehicleId`
  - `localServiceRecordId/localServiceLocalId -> cloudServiceRecordId`
  - `localRepairRecordId/localRepairLocalId -> cloudRepairRecordId`
  - `localAttachmentId/localAttachmentLocalId -> cloudAttachmentId`
- For child records, replace local parent IDs with cloud UUIDs in the cloud
  payload, while preserving the child's own `local_id`.

Do not reuse cloud UUIDs as local SQLite primary keys, and do not change local
record IDs during migration.

## 5. Duplicate Prevention Strategy

The safest duplicate prevention strategy is to make migration idempotent around
`user_id + local_id`.

Current schema readiness:

- `vehicles_user_local_id_unique`
- `odometer_entries_user_local_id_unique`
- `service_records_user_local_id_unique`
- `repair_records_user_local_id_unique`
- `maintenance_reminders_user_local_id_unique`
- `record_attachments_user_local_id_unique`

Recommended behavior:

- Preserve local `local_id` in every cloud row.
- Use upsert or select-by-`user_id`-and-`local_id` before insert.
- On retry, treat an existing cloud row with the same `local_id` as already
  migrated and refresh the local mapping table from Supabase.
- Do not use fuzzy duplicate matching by title/date/odometer for v1 migration.
  It can create false positives and accidental data loss.
- For attachments, use a deterministic Storage path based on the preserved
  attachment `local_id` and migrated parent record IDs. If the object already
  exists on retry, verify or replace only as part of a deliberate idempotent
  retry policy.

Important caveat: if a live Supabase project was created before these unique
constraints were added, rerunning `002_cloud_data_schema_rls.sql` may not add
missing constraints because the table definitions use `create table if not
exists`. Before implementing migration, add and run a small SQL verification or
patch that confirms every `*_user_local_id_unique` constraint exists.

## 6. Failure Handling Strategy

Migration should be resumable and should never delete local data because of a
cloud failure.

Recommended behavior:

- Treat each entity as independently retryable after its dependencies are
  migrated.
- Mark local migration status separately from product record data. Suggested
  statuses: `not_started`, `pending`, `synced`, `failed`, `skipped`.
- If a vehicle fails, skip its dependent child records and show them as blocked
  by vehicle migration.
- If an odometer, service, repair, or reminder row fails, continue with other
  rows for the same vehicle and record the failure.
- If attachment upload fails, keep the parent cloud record migrated and record
  only the attachment as failed.
- If attachment upload succeeds but metadata insert fails, attempt cleanup of
  the uploaded object. If cleanup also fails, record a retry warning.
- Do not delete local records, local attachment files, or notification settings
  on success or failure.
- Show user-friendly errors with a summary such as "12 records synced, 2
  attachments need attention" and a detail list by record type.
- Avoid logging local attachment contents, private file URIs beyond diagnostic
  metadata, or signed URLs.

## 7. Local Data Retention Strategy

Do not delete local data immediately after migration.

Recommended approach:

- Keep local guest records in SQLite after successful migration.
- Mark migration state in a dedicated mapping/status table or per-row migration
  metadata.
- Keep `sync_status` semantics conservative. It can remain `local_only` for the
  local guest copy, or move to `synced` only if the app deliberately treats local
  rows as migrated copies. Avoid overloading this field without a clear UX.
- Add a later verified cleanup option after the user has seen cloud data load
  correctly from the account.
- Cleanup should be an explicit user action, not automatic after sign-in.
- Local notification IDs should remain local and should be canceled or cleaned
  only if a future cleanup flow removes local reminders.

## 8. Attachment Migration Strategy

Attachments should migrate last because they depend on cloud vehicle IDs and
cloud service/repair record IDs.

Recommended flow:

1. Read local attachment metadata from `record_attachments`.
2. Verify exactly one parent exists: `service_record_id` or `repair_record_id`.
3. Resolve the local vehicle ID and local parent record ID through the migration
   mapping table.
4. Verify the local file URI with Expo FileSystem before upload.
5. Upload to the private `record-attachments` bucket under a user-scoped path:

   ```text
   {userId}/vehicles/{cloudVehicleId}/service-records/{cloudServiceRecordId}/{localAttachmentId}-{fileName}
   {userId}/vehicles/{cloudVehicleId}/repair-records/{cloudRepairRecordId}/{localAttachmentId}-{fileName}
   ```

6. Insert or upsert `public.record_attachments` metadata with:
   - preserved `local_id`
   - cloud `vehicle_id`
   - cloud `service_record_id` or cloud `repair_record_id`
   - `storage_bucket = "record-attachments"`
   - generated `storage_path`
   - `local_uri = null` in cloud
   - preserved file metadata and OCR placeholder fields
   - `sync_status = "synced"`

Missing or inaccessible files:

- Do not fail the whole migration.
- Mark that attachment as failed or skipped with a clear reason.
- Keep the local attachment metadata and local URI untouched.
- Include the attachment in the completion summary as "not uploaded".

Implementation note: current `createCloudAttachmentForServiceRecord` and
`createCloudAttachmentForRepairRecord` are good references for validation,
Storage upload, cleanup, and signed URL behavior, but migration needs a
dedicated function that preserves local IDs and supports idempotent retry.

## 9. Suggested UX Flow

After sign-in or sign-up, detect local guest data with `hasAnyLocalGuestData`.
If local data exists and the current account has no completed migration for that
local dataset, show a prompt:

```text
You have local AutoLedger records on this device. Would you like to back them up
and sync them to your account?
```

Offer:

- Review first
- Sync now
- Not now

Recommended UX details:

- "Review first" shows counts by type: vehicles, odometer entries, service
  records, repair records, reminders, and attachments.
- "Sync now" starts migration and shows progress by phase.
- "Not now" dismisses the prompt without changing local data and keeps the
  prompt available in Settings.
- Completion shows counts synced and counts skipped/failed.
- Failures should be grouped by record type and avoid alarming language.
- Make it clear local data remains on the device either way.
- Do not block the signed-in user from creating new cloud records if they defer
  migration.

## 10. Suggested Implementation Slices

Slice 1: migration audit/status detection only - complete

- Add local migration status/mapping schema.
- Add a read-only local data summary helper with counts and dependency checks.
- Add tests for detection and summary shape.
- Show only non-actionable sign-in/sign-up notices and a read-only Settings
  readiness section. No upload action is enabled.

Slice 2: migrate vehicles only - complete

- Add dedicated vehicle migration upsert helper preserving local IDs and
  archived state.
- Add local mapping persistence for vehicle cloud UUIDs.
- Add retry behavior using `user_id + local_id`.
- Add tests for duplicate prevention and partial vehicle failure.

Slice 3: migrate odometer entries only - complete

- Migrate odometer rows using the vehicle mapping.
- Preserve local odometer entry IDs and user-entered fields.
- Skip odometer entries whose vehicle mapping is missing.
- Recalculate affected cloud vehicle odometers after migration.
- Do not migrate service records, repair records, reminders, or attachments.

Slice 4: migrate service/repair/reminders

- Migrate remaining child rows using the vehicle mapping.
- Preserve local IDs and user-entered fields.
- Do not copy local notification IDs to cloud reminders.
- Recalculate cloud vehicle odometers after service/repair migration, or use a
  batch-safe recalculation at the end of each vehicle.

Slice 5: migrate attachments

- Upload local photo/PDF files to Supabase Storage.
- Create cloud attachment metadata after upload.
- Make retries idempotent around local attachment IDs and deterministic Storage
  paths.
- Report missing/inaccessible local files without failing parent records.

Slice 6: cleanup/retry UX

- Add Settings entry for migration status and retry.
- Add failure details and a retry failed items action.
- Add an explicit cleanup option only after verified successful migration.

## 11. Required Schema Changes, If Any

Cloud schema:

- `local_id` fields already exist for all relevant cloud tables in the current
  SQL.
- `unique (user_id, local_id)` constraints already exist in the current SQL.
- RLS already scopes every cloud data table to `auth.uid() = user_id`.
- Storage RLS already scopes attachment files to the authenticated user's first
  path segment.
- `packages/db/sql/004_verify_local_id_unique_constraints.sql` is now available
  as a read-only verification query for the cloud `user_id + local_id` unique
  constraints, including `odometer_entries_user_local_id_unique`. Review/run it
  before using vehicle or odometer migration. If any row reports `missing`, add
  the missing unique constraint before testing migration.

Local schema:

- Durable local migration state now exists as separate tables instead of
  per-record columns.
- Local migration state stores `account_id` so one device can distinguish
  readiness state for different signed-in accounts.
- The mapping table can store cloud UUID mappings for all migrated entity
  types. Slice 2 writes mappings for `entity_type = 'vehicle'`; Slice 3 writes
  mappings for `entity_type = 'odometer_entry'`.
- A migration run table exists with start/end timestamps, status, optional error
  message, vehicle-only and odometer-only scopes, vehicle run counts, and
  odometer run counts.

Suggested local-only tables:

```text
migration_runs
- id
- account_id
- migration_scope
- status
- started_at
- completed_at
- total_vehicles
- migrated_vehicles
- skipped_vehicles
- failed_vehicles
- total_odometer_entries
- migrated_odometer_entries
- skipped_odometer_entries
- skipped_odometer_entries_missing_vehicle_mapping
- failed_odometer_entries
- error_message
- created_at
- updated_at

migration_entity_mappings
- id
- run_id
- account_id
- entity_type
- local_id
- cloud_id
- status
- error_message
- created_at
- updated_at
```

RLS considerations:

- Do not weaken RLS for migration.
- Use only the authenticated user's anon-client session from mobile.
- Continue inserting rows with `user_id = auth.uid()`.
- Do not use or expose the Supabase service role key in mobile or browser code.

## 12. Suggested Tests

Unit tests:

- ID mapping creates and reuses `local_id -> cloud_id` mappings.
- Vehicle-only migration preserves local `local_id` and archived state.
- Odometer-only migration preserves local `local_id` and timestamps.
- Odometer-only migration uses vehicle mappings to attach entries to cloud
  vehicle UUIDs.
- Duplicate prevention treats existing `user_id + local_id` cloud rows as
  already migrated.
- Partial failure skips dependent records when a vehicle fails.
- Missing vehicle mapping skips the odometer entry safely and creates a skipped
  mapping row.
- Attachment failures do not mark parent service/repair records as failed.
- Completed reminders preserve `is_completed` and `completed_at`.
- Local `scheduled_notification_id` is omitted or nulled in cloud reminder
  payloads.
- Archived vehicles and their records are included in migration summaries.

Integration-style tests with mocked Supabase/FileSystem:

- Vehicle upsert retry does not create duplicates.
- Vehicle-only migration does not read or upload child records.
- Odometer migration retry does not create duplicates.
- Odometer migration uses cloud vehicle UUIDs, not local SQLite IDs.
- Odometer migration does not read or upload service, repair, reminder, or
  attachment records.
- Attachment migration uses cloud parent IDs in Storage paths.
- Existing Storage object or metadata retry is handled deterministically.
- Missing local attachment URI produces a skipped/failed attachment result
  without data loss.

Manual Expo Go checklist:

- Create guest data for every entity type, including one archived vehicle.
- Add service and repair attachments with a photo and PDF.
- Sign up for a new account and verify the migration prompt appears.
- Choose "Not now" and confirm no data is uploaded and guest data still works.
- Choose "Review first" and verify counts match local records.
- Review/run `packages/db/sql/004_verify_local_id_unique_constraints.sql`.
- Run "Migrate vehicles to account" with a clean account and verify cloud
  vehicles appear after app restart.
- Run vehicle migration again and verify no duplicate cloud vehicle rows are
  created.
- Run "Migrate odometer entries to account" and verify cloud odometer entries
  are attached to the correct cloud vehicles.
- Run odometer migration again and verify no duplicate cloud odometer rows are
  created.
- Confirm service records, repair records, reminders, and attachments were not
  migrated yet.
- Turn off network during child record or attachment migration and verify retry
  resumes without deleting local data.
- Delete or make one local attachment file inaccessible and verify the
  completion summary reports only that attachment as not uploaded.
- Sign out and verify local guest records remain on the device.

## Key Risks Discovered

- Current cloud CRUD helpers are not migration-safe because they generate new
  local IDs and omit complete local row metadata. Vehicle and odometer migration
  use dedicated helpers instead.
- Durable local mapping/status tables exist and are now used for vehicle and
  odometer migration. Later child-record migration must reuse the vehicle
  mapping table.
- Attachment retry needs careful idempotency because file upload and metadata
  insert are two separate operations.
- Archived local vehicles need special handling because some cloud helper
  validation paths only load active cloud vehicles.
- Existing live Supabase projects should verify `user_id + local_id` unique
  constraints before migration is enabled.

## Next Safest Slice

The next safest implementation slice is service-record migration using the
vehicle mapping table. It should preserve local IDs, skip records whose vehicle
mapping failed, avoid migrating attachments until the attachment slice, and
continue retaining all local guest data.
