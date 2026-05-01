# AutoLedger Current Status

## Completed

The AutoLedger project has been created as a pnpm monorepo.

The web app runs successfully on port 3000.

The mobile app runs successfully through Expo and has been tested in Expo Go.

The app is still local guest-mode first and now includes the core local maintenance-reminders slice.

Local device notification support has been added for maintenance reminders that have a due date. Notifications are optional, requested from Settings, and scheduled locally on the device only.

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
- Update vehicle current odometer from service records
- Add/list/edit/delete repair records
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

## Not Implemented Yet

Do not assume these exist yet:

- Supabase auth
- Cloud sync
- Guest-to-account migration
- Attachments/photos/PDFs
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

The next recommended feature should continue guest-mode polish before moving to auth, sync, attachments, or export.

Good candidates:

- Improve Vehicle Detail usability around the new history/timeline
- Add focused tests for shared validation, odometer/history logic, and reminder status logic
- Review any remaining Phase 2 empty/loading/error states

Do not implement attachment handling, notification scheduling, auth, sync, or export before the local guest-mode record and reminder experience is stable.
