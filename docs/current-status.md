# AutoLedger Current Status

## Completed

The AutoLedger project has been created as a pnpm monorepo.

The web app runs successfully on port 3000.

The mobile app runs successfully through Expo and has been tested in Expo Go.

Current development track: Local guest MVP features, optional Supabase Auth foundation, Supabase cloud data schema/RLS foundation, mobile cloud vehicle CRUD, and mobile cloud odometer entry CRUD are complete; broader app-side cloud sync is next.

The app is still local guest-mode first. Users can manage vehicles, odometer entries, service records, repair records, reminders, local attachments, and local CSV export without creating an account.

Optional Supabase Auth foundation has been added for mobile and web. Users can create an account, sign in, and sign out without forcing account creation or uploading local guest data.

Supabase cloud data schema and Row Level Security foundation has been added as SQL. The schema covers vehicles, optional vendors, odometer entries, service records, repair records, maintenance reminders, and record attachment metadata.

Mobile authenticated users can create, list, view, edit, archive, and restore cloud vehicle rows in Supabase. Authenticated users can also create, list, edit, and delete cloud odometer entries for cloud vehicles. The app does not read from or write to the other cloud record tables yet.

Local device notification support has been added for maintenance reminders that have a due date. Notifications are optional, requested from Settings, and scheduled locally on the device only.

Local attachment support has been added for service and repair records. Attachment metadata is stored in the local guest SQLite database, and selected files are copied into app-controlled local document storage when possible.

Local photo attachments can be previewed inside AutoLedger from an attachment detail screen. PDF attachments show local metadata and can be shared/opened with the device's PDF viewer.

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
- Cloud vehicle current odometer is updated from cloud odometer entries without using local guest odometer data
- Signed-in mobile users with existing local guest records see that cloud sync for those records is coming soon
- Export local guest data to a combined CSV file from Settings
- CSV export includes vehicles, odometer entries, service records, repair records, maintenance reminders, and attachment metadata

## Working Web Auth Foundation

- Web login route at `/login`
- Web signup route at `/signup`
- Web account/dashboard placeholder at `/dashboard`
- Supabase session refresh proxy for Next.js App Router
- Web account screens explain that cloud record sync is not active yet

## Supabase Setup Required

- Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the mobile app.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the web app.
- Use `apps/mobile/.env.example` and `apps/web/.env.example` as app-local templates when running app-specific dev commands.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to mobile or browser code.
- Run `packages/db/sql/001_profiles_auth_foundation.sql` in the Supabase SQL editor to create the `public.profiles` table, profile trigger, authenticated table grants, and RLS policies.
- Run `packages/db/sql/002_cloud_data_schema_rls.sql` in the Supabase SQL editor after the profiles SQL to create cloud data tables, indexes, triggers, relationships, authenticated table grants, and RLS policies.
- If the mobile app shows a Supabase "permission denied" warning for vehicles, rerun `packages/db/sql/002_cloud_data_schema_rls.sql` so the authenticated table grants are applied.
- See `docs/supabase-cloud-schema.md` for setup notes and simple SQL sanity checks.

## Current Cloud Limitations

- Account creation is optional and currently unlocks cloud vehicle CRUD and cloud odometer entry CRUD only.
- Local guest records are not uploaded after sign-in or sign-up.
- Guest-to-account migration is not implemented.
- Cloud vendor, service, repair, reminder, and attachment metadata tables exist as SQL setup, but app-side cloud save/load is not implemented for those record types.
- Cloud vehicle `current_odometer` is saved on the vehicle row and is recalculated from cloud odometer entries after cloud odometer entry edits/deletes. Cloud service and repair records do not update cloud odometer yet.
- Supabase Storage/cloud attachments are not implemented.
- Web cloud vehicle CRUD is deferred; the web app remains an auth/dashboard placeholder.

## Cloud Vehicle RLS Manual Verification

After running `packages/db/sql/001_profiles_auth_foundation.sql` and `packages/db/sql/002_cloud_data_schema_rls.sql` in Supabase:

- Confirm the SQL includes grants for the `authenticated` role; table privileges are required before RLS policies can evaluate owner rows.
- Signed-in mobile user can create a vehicle from the app and see a row in `public.vehicles` with `user_id = auth.uid()`.
- Signed-in mobile user can reload the app and read their own active vehicle from Supabase.
- Signed-in mobile user can edit and archive their own vehicle, then restore it from Archived Vehicles.
- Signed-in mobile user can create, reload, edit, and delete their own odometer entries in `public.odometer_entries`.
- Signed-in mobile user's cloud vehicle `current_odometer` updates from their own cloud odometer entries and does not use local guest odometer entries.
- Signed-out mobile user continues to use local guest vehicle storage and cannot access cloud vehicles through the app.
- A second signed-in user does not see or update the first user's vehicles. Do not add public read policies.

## Current Reminder Notification Limitations

- Reminder notifications are local device notifications only.
- Cloud push notifications, Expo push tokens, and server-side notification delivery are not implemented.
- Pure mileage reminders do not schedule notifications because AutoLedger does not track mileage in the background. Mileage reminder status remains in-app.
- Date-or-mileage reminders can schedule a local notification only when they include a due date.
- Expo Go on Android with SDK 53+ does not support remote push notifications, but local notifications remain available. AutoLedger does not request push tokens or register devices for push.
- Notification APIs are still treated as optional at runtime so reminders keep working in-app if local notification permission or scheduling is unavailable.
- A development build may be needed later for final notification behavior testing on device.

## Current Attachment Limitations

- Attachments are local guest-mode only.
- Attachment metadata is stored locally in SQLite.
- Cloud attachment metadata schema exists in SQL, but the app does not sync local attachment metadata to Supabase yet.
- Selected photos and PDFs are copied into app-controlled local document storage when possible. PDF attachments must copy successfully and verify as non-empty before metadata is saved. If copying fails for a photo in a runtime-specific case, the original local URI is preserved so the metadata still exists.
- Photos preview inside AutoLedger. PDFs still rely on an installed platform PDF viewer and use the native sharing sheet for a more reliable handoff.
- Supabase Storage, cloud attachment sync, signed/private cloud file access, and OCR are not implemented.
- Vehicle-level documents are not implemented.

## Current CSV Export Limitations

- CSV export is local guest-mode only.
- Export creates one combined CSV file with a dataset column instead of a zip archive of separate CSV files.
- The export file is written locally and handed to the device share sheet when sharing is available.
- Attachment export includes metadata and local file URIs only. It does not bundle attachment files.
- PDF export, cloud backup/sync, and server-side export are not implemented.

## Not Implemented Yet

Do not assume these exist yet:

- Broader cloud record sync beyond vehicles and odometer entries
- Cloud service/repair/reminder/attachment sync
- Guest-to-account migration
- Supabase Storage/cloud file attachments
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

The next recommended feature track is guest-to-account migration design and the next focused cloud sync slice, while preserving guest mode as the default local experience.

Good candidates:

- Add focused tests for shared validation, odometer/history logic, attachment validation, reminder status logic, and CSV export logic
- Generate Supabase database TypeScript types from the live project after running the SQL
- Prepare guest-to-account migration design before implementing sync

Do not implement households, fuel tracking, VIN lookup, OCR, payments/subscriptions, PDF export, fleet/business tooling, or an auto shop portal unless specifically requested.
