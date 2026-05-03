# AutoLedger Current Status

## Completed

The AutoLedger project has been created as a pnpm monorepo.

The web app runs successfully on port 3000.

Web Slice 1 is complete. The web app now has authenticated cloud-account
visibility for signed-in users:
`/dashboard` shows account cloud summaries, vehicle cards, upcoming reminders,
and recent odometer/service/repair activity; `/vehicles` lists cloud vehicles;
and `/vehicles/[vehicleId]` shows cloud vehicle detail with display-only
odometer entries, service records, repair records, reminders, and service/repair
attachment metadata.

Web Slice 2 is complete. Signed-in web users can create cloud vehicles at
`/vehicles/new`, edit active cloud vehicles at `/vehicles/[vehicleId]/edit`,
archive active cloud vehicles from vehicle detail, and restore archived cloud
vehicles from the vehicle list or detail page. Web remains cloud-account-only
and does not read or mutate local mobile guest data.

Web Slice 3 is complete. Signed-in web users can create cloud odometer entries
at `/vehicles/[vehicleId]/odometer/new`, edit and delete cloud odometer entries
at `/vehicles/[vehicleId]/odometer/[entryId]/edit`, and see those entries on
vehicle detail pages. Web cloud odometer writes update/recalculate the cloud
vehicle `current_odometer` from cloud odometer, service, and repair rows only.
Web remains cloud-account-only and does not read or mutate local mobile guest
data.

Web Slice 4 is complete. Signed-in web users can create cloud service records
at `/vehicles/[vehicleId]/service-records/new`, view cloud service record
detail at `/vehicles/[vehicleId]/service-records/[serviceRecordId]`, edit and
delete cloud service records at
`/vehicles/[vehicleId]/service-records/[serviceRecordId]/edit`, and see those
records on vehicle detail pages and in existing cloud history/recent activity
views. Web cloud service record writes update/recalculate the cloud vehicle
`current_odometer` from cloud odometer, service, and repair rows only. Web
remains cloud-account-only and does not read or mutate local mobile guest data.

Web Slice 5 is complete. Signed-in web users can create cloud repair records at
`/vehicles/[vehicleId]/repair-records/new`, view cloud repair record detail at
`/vehicles/[vehicleId]/repair-records/[repairRecordId]`, edit and delete cloud
repair records at
`/vehicles/[vehicleId]/repair-records/[repairRecordId]/edit`, and see those
records on vehicle detail pages and in existing cloud history/recent activity
views. Web cloud repair record writes update/recalculate the cloud vehicle
`current_odometer` from cloud odometer, service, and repair rows only. Web
remains cloud-account-only and does not read or mutate local mobile guest data.

Web Slice 6 is complete. Signed-in web users can create cloud maintenance
reminders at `/vehicles/[vehicleId]/reminders/new`, view cloud reminder detail
at `/vehicles/[vehicleId]/reminders/[reminderId]`, edit cloud reminders at
`/vehicles/[vehicleId]/reminders/[reminderId]/edit`, complete cloud reminders,
delete cloud reminders, and see active and completed reminders on vehicle detail
pages. Web cloud reminder status uses shared reminder logic with the cloud
vehicle `current_odometer`. Web remains cloud-account-only, does not read or
mutate local mobile guest data, and does not schedule local or cloud
notifications.

Web Slice 7 is complete. Signed-in web users can view existing cloud
service/repair attachment metadata on service and repair record detail pages
and open those private files through short-lived Supabase Storage signed URLs.

Web Slice 8 is complete. Signed-in web users can upload cloud photo/PDF
attachments from service and repair record detail pages, delete existing cloud
service/repair attachments, and continue opening private files through
short-lived Supabase Storage signed URLs. Web attachment edit/rename, OCR,
export, guest migration, vehicle-level documents, and local guest attachment
flows remain deferred. Mobile behavior was not changed by this web attachment
upload/delete slice.

The mobile app runs successfully through Expo and has been tested in Expo Go.

An initial testing foundation has been added. Root test scripts now cover
Vitest package tests for shared domain and validation logic plus Jest Expo
mobile tests for focused user-visible behavior. A lightweight Maestro mobile
E2E smoke scaffold and `docs/testing.md` are also present.

Current development track: Local guest MVP features, optional Supabase Auth foundation, Supabase cloud data schema/RLS foundation, mobile cloud vehicle CRUD, mobile cloud odometer entry CRUD, mobile cloud service record CRUD, mobile cloud repair record CRUD, mobile cloud maintenance reminder CRUD, cloud service/repair record attachments, guest-to-account vehicle migration, guest-to-account odometer-entry migration, guest-to-account service-record migration, guest-to-account repair-record migration, guest-to-account maintenance-reminder migration, guest-to-account service/repair attachment migration, final guest-to-account migration review/status/retry UX, mobile navigation polish, web authenticated cloud dashboard/vehicle read-only views, web cloud vehicle create/edit/archive/restore, web cloud odometer entry create/edit/delete, web cloud service record create/view/edit/delete, web cloud repair record create/view/edit/delete, web cloud maintenance reminder create/view/edit/complete/delete, and web cloud service/repair attachment viewing/upload/delete are complete; broader app-side cloud sync and broader web attachment edit/export flows are next.

The app is still local guest-mode first. Users can manage vehicles, odometer entries, service records, repair records, reminders, local attachments, and local CSV export without creating an account.

Optional Supabase Auth foundation has been added for mobile and web. Users can create an account, sign in, and sign out without forcing account creation or uploading local guest data.

Supabase cloud data schema and Row Level Security foundation has been added as SQL. The schema covers vehicles, optional vendors, odometer entries, service records, repair records, maintenance reminders, and record attachment metadata. Private Supabase Storage setup SQL exists for service/repair record attachments.

Mobile authenticated users can create, list, view, edit, archive, and restore cloud vehicle rows in Supabase. Authenticated users can also create, list, view, edit, and delete cloud odometer entries, cloud service records, cloud repair records, and cloud maintenance reminders for cloud vehicles. Authenticated users can add, list, open through signed URLs, and delete cloud photo/PDF attachments for cloud service and repair records.

Local device notification support has been added for maintenance reminders that have a due date. Notifications are optional, requested from Settings, and scheduled locally on the device only.

Local attachment support has been added for service and repair records. Attachment metadata is stored in the local guest SQLite database, and selected files are copied into app-controlled local document storage when possible.

Local photo attachments can be previewed inside AutoLedger from an attachment detail screen. PDF attachments show local metadata and can be shared/opened with the device's PDF viewer.

Cloud attachment support has been added for authenticated service and repair records. Files are uploaded to a private `record-attachments` Supabase Storage bucket in user-scoped paths, and metadata is stored in `public.record_attachments`.

Guest-to-account migration readiness planning has been completed, and the plan lives at `docs/guest-to-account-migration-plan.md`.

Guest-to-account migration Slice 1 has been added for local readiness. The mobile app now has local-only migration run and entity mapping tables, a read-only guest migration summary helper, a signed-in Settings readiness section, and non-destructive sign-in/sign-up notices when local guest data exists.

Guest-to-account migration Slice 2 has been added for vehicles only. Signed-in users can copy local guest vehicles, including archived vehicles, into their Supabase account from Settings. Vehicle migration preserves each local vehicle `local_id`, records local `local_id -> cloud UUID` mappings, uses `user_id + local_id` duplicate prevention, and keeps all local guest data on the device.

Guest-to-account migration Slice 3 has been added for odometer entries only. Signed-in users can copy local guest odometer entries into Supabase after vehicle mappings exist. Odometer migration preserves each local odometer entry `local_id`, attaches entries through the local vehicle mapping table, creates `odometer_entry` migration mappings, uses `user_id + local_id` duplicate prevention, recalculates affected cloud vehicle odometers, and keeps all local guest data on the device.

Guest-to-account migration Slice 4 has been added for service records only. Signed-in users can copy local guest service records into Supabase after vehicle mappings exist. Odometer migration is recommended before service migration so cloud odometer history is complete, but service migration's hard prerequisite is vehicle mapping. Service migration preserves each local service record `local_id`, maps local vehicle IDs to cloud vehicle UUIDs, creates `service_record` migration mappings, preserves service dates, categories, vendor names, costs, notes, timestamps, and uses `user_id + local_id` duplicate prevention. It recalculates affected cloud vehicle odometers and keeps all local guest data on the device. Repair records, maintenance reminders, and attachments are not migrated by this slice.

Guest-to-account migration Slice 5 has been added for repair records only. Signed-in users can copy local guest repair records into Supabase after vehicle mappings exist. Odometer and service migration are recommended before repair migration so cloud history is complete, but repair migration's hard prerequisite is vehicle mapping. Repair migration preserves each local repair record `local_id`, maps local vehicle IDs to cloud vehicle UUIDs, creates `repair_record` migration mappings, preserves repair dates, categories, vendor names, costs, warranty fields, notes, timestamps, and uses `user_id + local_id` duplicate prevention. It recalculates affected cloud vehicle odometers and keeps all local guest data on the device. Maintenance reminders and attachments are not migrated by this slice.

Guest-to-account migration Slice 6 has been added for maintenance reminders only. Signed-in users can copy local guest maintenance reminders into Supabase after vehicle mappings exist. Odometer, service, and repair migration are recommended before reminder migration so mileage-based reminder status has the best cloud odometer context, but reminder migration's hard prerequisite is vehicle mapping. Reminder migration preserves each local reminder `local_id`, maps local vehicle IDs to cloud vehicle UUIDs, creates `maintenance_reminder` migration mappings, preserves date, mileage, date-or-mileage, repeat interval, completed, completed-at, last-triggered, notes, and timestamp fields, uses `user_id + local_id` duplicate prevention, sets cloud `scheduled_notification_id` to null, and keeps all local guest data on the device.

Guest-to-account migration Slice 7 has been added for service/repair attachments only. Signed-in users can copy local guest service-record and repair-record attachments into the private Supabase `record-attachments` Storage bucket after the related service/repair parent record mappings exist. Attachment migration preserves each local attachment `local_id`, maps local vehicle and parent record IDs to cloud UUIDs, creates `record_attachment` migration mappings, writes cloud `record_attachments` metadata only after file upload succeeds, uses deterministic user-scoped Storage paths and `user_id + local_id` duplicate prevention, reports missing parent mappings, unsupported relationships, missing local files, upload failures, metadata failures, and cleanup failures, and keeps all local guest data and local files on the device.

Guest-to-account migration Slice 8 has been added for final review/status/retry UX. Signed-in users with local guest data can open Cloud Migration from Settings to review local counts, migrated/mapped counts, skipped and failed mapping counts, per-step readiness, prerequisites, retry actions, and a "Migrate Remaining Data" action that runs ready migration slices in order. This UX still only copies supported records, keeps all local guest data and local files on the device, and does not implement automatic cleanup or continuous sync.

Local CSV export support has been added for guest-mode data. Export creates one combined CSV file locally and opens the device share sheet when available.

## Working Mobile Features

The mobile app currently supports local guest-mode:

- Add vehicle
- List vehicles
- View vehicle detail
- Edit vehicle
- Archive vehicle
- Persist vehicles locally
- Add/list/edit/delete odometer entries
- Update vehicle current odometer from odometer entries
- Add/list/edit/delete service records
- Optional vendor/shop name on local service records
- Add/list/delete local photo and PDF attachments on service records
- In-app local photo attachment preview for service records
- Verified local PDF copies before saving service record attachment metadata
- Update vehicle current odometer from service records
- Add/list/edit/delete repair records
- Optional vendor/shop name on local repair records
- Add/list/delete local photo and PDF attachments on repair records
- In-app local photo attachment preview for repair records
- Verified local PDF copies before saving repair record attachment metadata
- Update vehicle current odometer from repair records
- Unified vehicle history/timeline combining odometer entries, service records, and repair records
- Polished mobile dashboard with local summary counts, vehicle cards, and recent activity
- Bottom-tab mobile navigation for Garage, Activity, Reminders, and Settings
- Cross-vehicle Activity tab for local or cloud odometer, service, and repair history
- Add Activity flow from the Activity tab for odometer, service, and repair records
- Cross-vehicle Reminders tab for active and completed local or cloud reminders
- Add Reminder flow from the Reminders tab with vehicle selection when needed
- Vehicle detail segmented navigation for Overview, History, and Reminders
- Vehicle detail Add Record and More menus for common vehicle actions
- Add/list/view/edit/delete local maintenance reminders
- Complete maintenance reminders while keeping them visible as completed
- Date, mileage, and date-or-mileage reminder status logic
- Upcoming reminders on the mobile dashboard
- Vehicle detail reminder sections with active and completed reminders
- Optional local device notification settings for reminders
- Local scheduled notifications for date-based reminders when permission is enabled
- Local notification cancellation when reminders are completed, deleted, disabled, or rescheduled
- Optional Supabase account sign-up/sign-in/sign-out from mobile Settings
- Mobile account state persists through Supabase Auth storage
- Signed-in mobile users can add/list/view/edit/archive/restore cloud vehicles saved to Supabase
- Signed-in mobile users can add/list/edit/delete cloud odometer entries for cloud vehicles saved to Supabase
- Signed-in mobile users can add/list/view/edit/delete cloud service records for cloud vehicles saved to Supabase
- Signed-in mobile users can add/list/view/edit/delete cloud repair records for cloud vehicles saved to Supabase
- Signed-in mobile users can add/list/view/edit/complete/delete cloud maintenance reminders for cloud vehicles saved to Supabase
- Signed-in mobile users can add/list/open/delete cloud photo and PDF attachments on cloud service records
- Signed-in mobile users can add/list/open/delete cloud photo and PDF attachments on cloud repair records
- Cloud attachments are stored in a private Supabase Storage bucket and opened with short-lived signed URLs
- Cloud vehicle current odometer is updated from cloud odometer entries, cloud service records, and cloud repair records without using local guest data
- Signed-in mobile vehicle history and dashboard recent activity include cloud odometer entries, cloud service records, and cloud repair records
- Signed-in mobile dashboard upcoming reminders include active cloud maintenance reminders for active cloud vehicles
- Signed-in mobile users with existing local guest records see that migration happens in focused, non-destructive steps
- Signed-in mobile users with existing local guest records can view a Local Data / Migration Readiness summary in Settings
- Signed-in mobile users can run vehicle-only guest-to-account migration from Settings after reviewing the `004_verify_local_id_unique_constraints.sql` prerequisite
- Vehicle-only guest-to-account migration includes active and archived local vehicles, preserves local vehicle `local_id` values, and creates local vehicle migration mappings without deleting local guest vehicles
- Signed-in mobile users can run odometer-only guest-to-account migration from Settings after vehicle mappings exist and after reviewing the `004_verify_local_id_unique_constraints.sql` prerequisite
- Odometer-only guest-to-account migration preserves local odometer entry `local_id` values, maps local vehicle IDs to cloud vehicle UUIDs, creates local odometer migration mappings, skips entries whose vehicle mapping is missing, recalculates affected cloud vehicle odometers, and does not delete local guest odometer entries
- Signed-in mobile users can run service-record-only guest-to-account migration from Settings after vehicle mappings exist and after reviewing the `004_verify_local_id_unique_constraints.sql` prerequisite
- Service-record-only guest-to-account migration preserves local service record `local_id` values, maps local vehicle IDs to cloud vehicle UUIDs, creates local service record migration mappings, preserves service date, odometer reading, title, category, description, vendor name, cost, currency, notes, and timestamps, skips records whose vehicle mapping is missing, recalculates affected cloud vehicle odometers, and does not delete local guest service records
- Signed-in mobile users can run repair-record-only guest-to-account migration from Settings after vehicle mappings exist and after reviewing the `004_verify_local_id_unique_constraints.sql` prerequisite
- Repair-record-only guest-to-account migration preserves local repair record `local_id` values, maps local vehicle IDs to cloud vehicle UUIDs, creates local repair record migration mappings, preserves repair date, odometer reading, title, category, description, vendor name, cost, currency, warranty date, warranty odometer, notes, and timestamps, skips records whose vehicle mapping is missing, recalculates affected cloud vehicle odometers, and does not delete local guest repair records
- Signed-in mobile users can run maintenance-reminder-only guest-to-account migration from Settings after vehicle mappings exist and after reviewing the `004_verify_local_id_unique_constraints.sql` prerequisite
- Maintenance-reminder-only guest-to-account migration preserves local reminder `local_id` values, maps local vehicle IDs to cloud vehicle UUIDs, creates local maintenance reminder migration mappings, preserves date, mileage, date-or-mileage, repeat interval, completed, completed-at, last-triggered, notes, and timestamp fields, skips reminders whose vehicle mapping is missing, does not copy local notification IDs to cloud reminders, and does not delete local guest reminders
- Signed-in mobile users can run attachment-only guest-to-account migration from Settings after service-record or repair-record migration mappings exist and after reviewing the Storage SQL and unique constraint prerequisites
- Attachment-only guest-to-account migration preserves local attachment `local_id` values, maps local vehicle and service/repair parent IDs to cloud UUIDs, uploads files to private Supabase Storage, creates cloud metadata only after upload succeeds, repairs missing attachment mappings on rerun, skips attachments whose parent mapping is missing, reports missing local files without crashing, and does not delete local guest attachment metadata or local files
- Signed-in mobile users can open a Cloud Migration review screen from Settings that summarizes local guest counts, migrated mapping counts, skipped and failed mapping counts, overall migration state, and each migration step in order
- Cloud Migration shows per-step statuses for vehicles, odometer entries, service records, repair records, maintenance reminders, and attachments, including ready, blocked, completed, completed with issues, failed, and in-progress states
- Cloud Migration provides safe retry actions for incomplete or failed focused migration steps by calling the existing idempotent migration helpers
- Cloud Migration provides a "Migrate Remaining Data" action that runs currently ready steps in the recommended order while leaving blocked steps and individual step issues visible
- Cloud Migration completion messaging says supported local records were copied to the account and explicitly states that original local records remain on the device
- Export local guest data to a combined CSV file from Settings
- CSV export includes vehicles, odometer entries, service records, repair records, maintenance reminders, and attachment metadata

## Working Web Account Views

- Web login route at `/login`
- Web signup route at `/signup`
- Web account dashboard at `/dashboard` for signed-in users
- Web cloud vehicle list at `/vehicles`
- Web cloud vehicle create route at `/vehicles/new`
- Web cloud vehicle detail at `/vehicles/[vehicleId]`
- Web cloud vehicle edit route at `/vehicles/[vehicleId]/edit`
- Web cloud odometer entry create route at `/vehicles/[vehicleId]/odometer/new`
- Web cloud odometer entry edit/delete route at
  `/vehicles/[vehicleId]/odometer/[entryId]/edit`
- Web cloud service record create route at
  `/vehicles/[vehicleId]/service-records/new`
- Web cloud service record detail route at
  `/vehicles/[vehicleId]/service-records/[serviceRecordId]`
- Web cloud service record edit/delete route at
  `/vehicles/[vehicleId]/service-records/[serviceRecordId]/edit`
- Web cloud repair record create route at
  `/vehicles/[vehicleId]/repair-records/new`
- Web cloud repair record detail route at
  `/vehicles/[vehicleId]/repair-records/[repairRecordId]`
- Web cloud repair record edit/delete route at
  `/vehicles/[vehicleId]/repair-records/[repairRecordId]/edit`
- Web cloud maintenance reminder create route at
  `/vehicles/[vehicleId]/reminders/new`
- Web cloud maintenance reminder detail route at
  `/vehicles/[vehicleId]/reminders/[reminderId]`
- Web cloud maintenance reminder edit route at
  `/vehicles/[vehicleId]/reminders/[reminderId]/edit`
- Web cloud service record attachment open route at
  `/vehicles/[vehicleId]/service-records/[serviceRecordId]/attachments/[attachmentId]/open`
- Web cloud repair record attachment open route at
  `/vehicles/[vehicleId]/repair-records/[repairRecordId]/attachments/[attachmentId]/open`
- Supabase session refresh proxy for Next.js App Router
- Protected web account pages show a clear sign-in prompt when no session exists
- Web account views are cloud-account-only and do not read local mobile guest data
- Signed-in web users can create, edit, archive, and restore cloud vehicles
  saved to Supabase
- Web archived vehicles are visible separately from active vehicles on the
  vehicle list and can be restored
- Web vehicle detail includes display-only cloud odometer entries, service
  records, repair records, maintenance reminders, and service/repair attachment
  metadata
- Signed-in web users can create, edit, and delete cloud odometer entries for
  active cloud vehicles saved to Supabase
- Web cloud odometer entry writes update/recalculate cloud vehicle
  `current_odometer` without using local mobile guest data
- Signed-in web users can create, view, edit, and delete cloud service records
  for active cloud vehicles saved to Supabase
- Web cloud service record writes update/recalculate cloud vehicle
  `current_odometer` without using local mobile guest data
- Signed-in web users can create, view, edit, and delete cloud repair records
  for active cloud vehicles saved to Supabase
- Web cloud repair record writes update/recalculate cloud vehicle
  `current_odometer` without using local mobile guest data
- Signed-in web users can create, view, edit, complete, and delete cloud
  maintenance reminders for active cloud vehicles saved to Supabase
- Web cloud reminder status is calculated from cloud reminder fields and the
  cloud vehicle `current_odometer` without using local mobile guest data
- Signed-in web users can view existing cloud service/repair attachments on
  service and repair record detail pages and open private files through
  short-lived Supabase Storage signed URLs
- Signed-in web users can upload and delete cloud photo/PDF attachments on
  cloud service and repair record detail pages. Uploads use the private
  `record-attachments` Supabase Storage bucket and create
  `public.record_attachments` metadata only after Storage upload succeeds.
- Web attachment edit/rename, export, and guest-to-account migration write
  flows are still deferred
- Web does not schedule local reminder notifications or cloud push
  notifications
- Mobile behavior was not changed by the web maintenance reminder or web
  attachment viewing/download slices

## Supabase Setup Required

- Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the mobile app.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the web app.
- Use `apps/mobile/.env.example` and `apps/web/.env.example` as app-local templates when running app-specific dev commands.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to mobile or browser code.
- Run `packages/db/sql/001_profiles_auth_foundation.sql` in the Supabase SQL editor to create the `public.profiles` table, profile trigger, authenticated table grants, and RLS policies.
- Run `packages/db/sql/002_cloud_data_schema_rls.sql` in the Supabase SQL editor after the profiles SQL to create cloud data tables, indexes, triggers, relationships, authenticated table grants, and RLS policies.
- Run `packages/db/sql/003_record_attachments_storage_rls.sql` in the Supabase SQL editor after the cloud data schema to create the private `record-attachments` Storage bucket and user-scoped Storage RLS policies.
- Review/run `packages/db/sql/004_verify_local_id_unique_constraints.sql` before using guest-to-account vehicle, odometer, service record, repair record, or maintenance reminder migration. It is a read-only prerequisite check for the `user_id + local_id` unique constraints used to prevent duplicate migrated rows, including `public.service_records`, `public.repair_records`, and `public.maintenance_reminders`.
- If the mobile app shows a Supabase "permission denied" warning for vehicles, rerun `packages/db/sql/002_cloud_data_schema_rls.sql` so the authenticated table grants are applied.
- If cloud attachment upload/open/delete shows a bucket or permission warning, rerun `packages/db/sql/003_record_attachments_storage_rls.sql` so the private bucket and Storage RLS policies are installed.
- See `docs/supabase-cloud-schema.md` for setup notes and simple SQL sanity checks.

## Current Cloud Limitations

- Account creation is optional and currently unlocks cloud vehicle CRUD, cloud odometer entry CRUD, cloud service record CRUD, cloud repair record CRUD, cloud maintenance reminder CRUD, and cloud service/repair attachment support on mobile, plus cloud dashboard/vehicle visibility, cloud vehicle create/edit/archive/restore, cloud odometer entry create/edit/delete, cloud service record create/view/edit/delete, cloud repair record create/view/edit/delete, cloud maintenance reminder create/view/edit/complete/delete, and cloud service/repair attachment viewing/upload/delete on web.
- Local guest records are not uploaded automatically after sign-in or sign-up.
- Full automatic guest-to-account sync is not implemented. Vehicle-only, odometer-only, service-record-only, repair-record-only, maintenance-reminder-only, and service/repair attachment-only guest-to-account migration exist as focused manual Settings actions, with a Cloud Migration review/status/retry screen for managing those steps.
- Guest-to-account migration planning is complete in `docs/guest-to-account-migration-plan.md`, Slice 1 readiness/status detection is implemented locally, Slice 2 vehicle-only upload is implemented, Slice 3 odometer-only upload is implemented, Slice 4 service-record-only upload is implemented, Slice 5 repair-record-only upload is implemented, Slice 6 maintenance-reminder-only upload is implemented, Slice 7 attachment-only upload is implemented, and Slice 8 review/status/retry UX is implemented.
- Vehicle-only migration creates/repairs local `migration_entity_mappings` rows for vehicles. It does not delete local guest data, mutate local vehicle rows, migrate service/repair/reminder/attachment records, or mark child records as migrated.
- Odometer-only migration requires completed vehicle mappings, creates/repairs `migration_entity_mappings` rows with `entity_type = 'odometer_entry'`, preserves odometer entry `local_id`, and skips entries whose vehicle mapping is missing. It does not delete local guest data or mutate local odometer rows.
- Service-record-only migration requires completed vehicle mappings, creates/repairs `migration_entity_mappings` rows with `entity_type = 'service_record'`, preserves service record `local_id`, preserves simple `vendor_name` text while leaving `vendor_id = null`, and skips records whose vehicle mapping is missing. It does not delete local guest data, mutate local service rows, migrate local attachments, migrate repair records, or create cloud vendor rows.
- Repair-record-only migration requires completed vehicle mappings, creates/repairs `migration_entity_mappings` rows with `entity_type = 'repair_record'`, preserves repair record `local_id`, preserves simple `vendor_name` text while leaving `vendor_id = null`, preserves warranty fields, and skips records whose vehicle mapping is missing. It does not delete local guest data, mutate local repair rows, migrate local attachments, migrate reminders, or create cloud vendor rows.
- Maintenance-reminder-only migration requires completed vehicle mappings, creates/repairs `migration_entity_mappings` rows with `entity_type = 'maintenance_reminder'`, preserves reminder `local_id`, preserves date/mileage/date-or-mileage fields, repeat fields, completed state, `completed_at`, `last_triggered_at`, notes, and timestamps, and skips reminders whose vehicle mapping is missing. It does not delete local guest data, mutate local reminder rows, copy local `scheduled_notification_id` values, migrate attachments, or schedule cloud notifications.
- Attachment-only migration requires completed vehicle mappings and completed service-record or repair-record parent mappings, creates/repairs `migration_entity_mappings` rows with `entity_type = 'record_attachment'`, preserves attachment `local_id`, uploads files to deterministic private Storage paths, inserts cloud metadata after upload succeeds, reuses existing matching cloud metadata on rerun, skips unsupported or unmapped attachments, and does not delete or mutate local attachment rows or local files.
- Cloud vendor tables exist as SQL setup, but app-side cloud vendor CRUD is not implemented.
- Cloud service records use simple `vendor_name` text for now; structured `vendor_id` support is still deferred.
- Cloud repair records use simple `vendor_name` text for now; structured `vendor_id` support is still deferred.
- Cloud vehicle `current_odometer` is saved on the vehicle row and is recalculated from cloud odometer entries, cloud service records, and cloud repair records after cloud odometer/service/repair edits/deletes, after odometer-only migration, after service-record-only migration, and after repair-record-only migration. Local guest service and repair records are not included in cloud odometer calculations.
- Cloud maintenance reminder status is calculated in-app from the cloud reminder due fields and the cloud vehicle `current_odometer`.
- Cloud attachments are implemented only for cloud service and repair records. Vehicle-level cloud documents are not implemented.
- Web cloud vehicle create/edit/archive/restore, web cloud odometer entry
  create/edit/delete, web cloud service record create/view/edit/delete, web
  cloud repair record create/view/edit/delete, web cloud maintenance reminder
  create/view/edit/complete/delete, and web cloud service/repair attachment
  viewing/upload/delete are implemented for signed-in users. Web cloud
  attachment edit/rename, export, and guest-to-account migration write flows
  are still deferred.

## Cloud Vehicle RLS Manual Verification

After running `packages/db/sql/001_profiles_auth_foundation.sql` and `packages/db/sql/002_cloud_data_schema_rls.sql` in Supabase:

- Confirm the SQL includes grants for the `authenticated` role; table privileges are required before RLS policies can evaluate owner rows.
- Signed-in mobile user can create a vehicle from the app and see a row in `public.vehicles` with `user_id = auth.uid()`.
- Signed-in mobile user can reload the app and read their own active vehicle from Supabase.
- Signed-in mobile user can edit and archive their own vehicle, then restore it from Archived Vehicles.
- Signed-in mobile user can create, reload, edit, and delete their own odometer entries in `public.odometer_entries`.
- Signed-in mobile user can create, reload, view, edit, and delete their own service records in `public.service_records`.
- Signed-in mobile user can create, reload, view, edit, and delete their own repair records in `public.repair_records`.
- Signed-in mobile user can create, reload, view, edit, complete, and delete their own maintenance reminders in `public.maintenance_reminders`.
- Signed-in mobile user can add, reload, open, and delete their own service/repair record attachments, with metadata in `public.record_attachments` and files under their own first-level Storage folder in `record-attachments`.
- Signed-in mobile user's cloud vehicle `current_odometer` updates from their own cloud odometer entries, cloud service records, and cloud repair records and does not use local guest odometer/service/repair records.
- Signed-in mobile user's cloud reminder status uses their own cloud vehicle `current_odometer` and does not use local guest vehicle data.
- Signed-out mobile user continues to use local guest vehicle storage and cannot access cloud vehicles through the app.
- A second signed-in user does not see or update the first user's vehicles. Do not add public read policies.

## Current Reminder Notification Limitations

- Reminder notifications are local device notifications only.
- Cloud push notifications, Expo push tokens, and server-side notification delivery are not implemented.
- Cloud maintenance reminders are saved to Supabase and work in-app, but they do not schedule local or cloud notifications in this slice.
- Migrated cloud maintenance reminders do not inherit local scheduled notification IDs. Local notification scheduling remains local-only for guest reminders until a later notification/sync design.
- Pure mileage reminders do not schedule notifications because AutoLedger does not track mileage in the background. Mileage reminder status remains in-app.
- Date-or-mileage reminders can schedule a local notification only when they include a due date.
- Expo Go on Android with SDK 53+ does not support remote push notifications, but local notifications remain available. AutoLedger does not request push tokens or register devices for push.
- Notification APIs are still treated as optional at runtime so reminders keep working in-app if local notification permission or scheduling is unavailable.
- A development build may be needed later for final notification behavior testing on device.

## Current Attachment Limitations

- Attachments work in local guest mode and authenticated cloud mode for service and repair records only.
- Local attachment metadata is stored locally in SQLite.
- Cloud attachment metadata is stored in `public.record_attachments`, and cloud files are stored in the private `record-attachments` Supabase Storage bucket.
- Cloud attachment Storage paths are user-scoped, such as `{userId}/vehicles/{vehicleId}/service-records/{serviceRecordId}/{attachmentLocalId}-{fileName}` and `{userId}/vehicles/{vehicleId}/repair-records/{repairRecordId}/{attachmentLocalId}-{fileName}`.
- Selected photos and PDFs are copied into app-controlled local document storage when possible. PDF attachments must copy successfully and verify as non-empty before metadata is saved. If copying fails for a photo in a runtime-specific case, the original local URI is preserved so the metadata still exists.
- Local photos preview inside AutoLedger. Local PDFs still rely on an installed platform PDF viewer and use the native sharing sheet for a more reliable handoff.
- Cloud attachments are opened with short-lived signed URLs on mobile and web.
  Platform behavior depends on the installed browser/viewer and file type.
- Web service and repair record detail pages can upload cloud photo/PDF
  attachments, show existing cloud attachment metadata, delete cloud
  attachments, and open private files through short-lived Supabase Storage
  signed URLs. If upload succeeds but metadata insert fails, web attempts to
  remove the uploaded Storage object and reports cleanup failures without
  exposing a public file URL. Web attachment edit/rename and local guest
  attachment flows are still deferred.
- Existing local guest service/repair attachments can be uploaded through the focused attachment-only migration action after their parent service/repair records have been migrated. They are not uploaded automatically after sign-in or sign-up.
- OCR is not implemented.
- Vehicle-level documents are not implemented.

## Current CSV Export Limitations

- CSV export is local guest-mode only.
- Export creates one combined CSV file with a dataset column instead of a zip archive of separate CSV files.
- The export file is written locally and handed to the device share sheet when sharing is available.
- Attachment export includes local guest metadata and local file URIs only. It does not bundle attachment files and does not export cloud attachments yet.
- PDF export, cloud CSV export, and server-side export are not implemented.

## Not Implemented Yet

Do not assume these exist yet:

- Broader cloud record sync beyond vehicles, odometer entries, service records, repair records, maintenance reminders, and service/repair attachments
- Automatic full guest-to-account sync beyond the focused migration actions
- Automatic local guest data cleanup or delete-after-migration
- Vehicle-level cloud file attachments
- Cloud push notifications
- Households
- Fuel tracking
- VIN lookup
- OCR
- Payments/subscriptions
- PDF export
- Fleet/business tools
- Auto shop portal

## Recommended Next Feature

The next recommended feature track is a focused web cloud records slice or a carefully scoped cloud export/sync slice, while preserving guest mode as the default mobile experience and keeping web account views cloud-only.

Good candidates:

- Generate Supabase database TypeScript types from the live project after running the SQL.
- Continue focused tests around shared validation, odometer/history logic, attachment validation, reminder status logic, CSV export logic, and migration logic.
- Plan a focused web export or attachment edit/rename slice.

Do not implement households, fuel tracking, VIN lookup, OCR, payments/subscriptions, PDF export, fleet/business tooling, or an auto shop portal unless specifically requested.
