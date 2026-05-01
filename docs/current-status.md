# AutoLedger Current Status

## Completed

The AutoLedger project has been created as a pnpm monorepo.

The web app runs successfully on port 3000.

The mobile app runs successfully through Expo and has been tested in Expo Go.

The app is still local guest-mode first and now includes the core local maintenance-reminders slice.

Local device notification support has been added for maintenance reminders that have a due date. Notifications are optional, requested from Settings, and scheduled locally on the device only.

Local attachment support has been added for service and repair records. Attachment metadata is stored in the local guest SQLite database, and selected files are copied into app-controlled local document storage when possible.

Local photo attachments can be previewed inside AutoLedger from an attachment detail screen. PDF attachments show local metadata and can be shared/opened with the device's PDF viewer.

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

## Current Reminder Notification Limitations

- Reminder notifications are local device notifications only.
- Cloud push notifications, Expo push tokens, and server-side notification delivery are not implemented.
- Pure mileage reminders do not schedule notifications because AutoLedger does not track mileage in the background. Mileage reminder status remains in-app.
- Date-or-mileage reminders can schedule a local notification only when they include a due date.
- Expo Go on Android with SDK 53+ does not support remote push notifications. AutoLedger does not request push tokens or register devices for push.
- Local reminder notification code is guarded in Expo Go on Android so reminders keep working in-app if notification APIs are unavailable.
- A development build may be needed later for full local notification testing on device.

## Current Attachment Limitations

- Attachments are local guest-mode only.
- Attachment metadata is stored locally in SQLite.
- Selected photos and PDFs are copied into app-controlled local document storage when possible. PDF attachments must copy successfully and verify as non-empty before metadata is saved. If copying fails for a photo in a runtime-specific case, the original local URI is preserved so the metadata still exists.
- Photos preview inside AutoLedger. PDFs still rely on an installed platform PDF viewer and use the native sharing sheet for a more reliable handoff.
- Supabase Storage, cloud attachment sync, signed/private cloud file access, and OCR are not implemented.
- Vehicle-level documents are not implemented.

## Not Implemented Yet

Do not assume these exist yet:

- Supabase auth
- Cloud sync
- Guest-to-account migration
- Supabase Storage/cloud attachments
- Cloud push notifications
- CSV export
- Households
- Fuel tracking
- VIN lookup
- OCR
- Payments/subscriptions
- PDF export
- Fleet tools
- Auto shop portal

## Recommended Next Feature

The next recommended feature should continue guest-mode polish before moving to auth, sync, cloud attachments, or export.

Good candidates:

- Improve Vehicle Detail usability around the new history/timeline
- Add focused tests for shared validation, odometer/history logic, attachment validation, and reminder status logic
- Review any remaining Phase 2 empty/loading/error states

Do not implement cloud attachment handling, additional notification scheduling, auth, sync, or export before the local guest-mode record, attachment, and reminder experience is stable.
