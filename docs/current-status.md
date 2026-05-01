# AutoLedger Current Status

## Completed

The AutoLedger project has been created as a pnpm monorepo.

The web app runs successfully on port 3000.

The mobile app runs successfully through Expo and has been tested in Expo Go.

The app is still in Phase 2: local guest-mode core records.

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

## Not Implemented Yet

Do not assume these exist yet:

- Supabase auth
- Cloud sync
- Guest-to-account migration
- Attachments/photos/PDFs
- Reminders
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

The next recommended feature should continue Phase 2 guest-mode polish before moving to later phases.

Good candidates:

- Improve Vehicle Detail usability around the new history/timeline
- Add focused tests for shared validation and odometer/history logic
- Review any remaining Phase 2 empty/loading/error states

Do not implement reminders or attachments before the local guest-mode record experience is stable.
