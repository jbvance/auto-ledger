# AutoLedger Product Spec

## Product Summary

AutoLedger is a mobile-first app for tracking vehicle service, repairs, mileage, attachments, and maintenance reminders.

The target user is a family or individual managing multiple vehicles. The app should help answer:

- When did we last change the oil?
- What repairs have we done on this vehicle?
- How much have we spent on maintenance this year?
- When is the next service due?
- Where is the receipt for that repair?
- What records should we export before selling the vehicle?

The app should feel professional, calm, modern, trustworthy, and privacy-conscious.

---

## Primary Platforms

### Mobile

The main product is an Expo React Native app for iOS and Android.

### Web

The web app should provide:

- Marketing pages
- Login/signup
- User dashboard
- Vehicle records
- Reminders
- Export tools
- Future admin/support area

The web app should use Next.js App Router.

---

## Locked Product Decisions

- Project name: AutoLedger
- Primary experience: Mobile app first
- Web app: Same core user features as mobile
- Backend: Supabase
- Guest mode: Required in v1
- Account creation: Optional
- Cloud sync: Available after account creation
- Offline support: Nice to have later, but architecture should not block it
- Privacy posture: Strong
- Attachments: Photos and PDFs in v1
- OCR: Later
- VIN lookup: Later
- Reminders: Date-based and mileage-based in v1
- Target user: Families and individuals with multiple vehicles
- Design style: Modern dashboard/professional with consumer-friendly onboarding
- Monetization: Undecided
- Households/shared accounts: Later
- Fuel tracking: Later
- Export: CSV first, PDF later

---

## V1 Features

### Guest Mode

Users must be able to use the app without creating an account.

Guest users should be able to:

- Add a vehicle
- Edit a vehicle
- Add odometer entries
- Add service records
- Add repair records
- Add reminders
- Add photos/PDF attachments where locally feasible
- View dashboard/history
- Export CSV where feasible

The app should explain that creating an account enables cloud backup and sync.

---

### Optional Account and Cloud Sync

Users may create an account to back up and sync their data.

After sign-in or sign-up, if local guest records exist, show a migration prompt:

“You have local AutoLedger records on this device. Would you like to back them up and sync them to your account?”

Options:

- Sync now
- Not now
- Review records first

V1 should support simple cloud sync, but not complex conflict resolution.

---

### Vehicles

Users should be able to track multiple vehicles.

Vehicle fields should include:

- Nickname
- Make
- Model
- Year
- Trim
- VIN, optional
- License plate, optional
- License state, optional
- Color, optional
- Vehicle type
- Current odometer
- Odometer unit
- Purchase date, optional
- Purchase odometer, optional
- Notes

Do not implement VIN lookup in v1.

---

### Odometer Entries

Users should be able to log odometer readings over time.

Odometer entries should support:

- Vehicle
- Reading
- Date
- Unit
- Source/type
- Notes

---

### Service Records

Service records are for routine maintenance.

Examples:

- Oil change
- Tire rotation
- Inspection
- Fluid change
- Scheduled maintenance
- Battery replacement
- Brake service

Service records should include:

- Vehicle
- Service date
- Odometer reading
- Title
- Category
- Description
- Vendor, optional
- Cost
- Notes
- Attachments

---

### Repair Records

Repair records are for non-routine repairs.

Examples:

- Engine repair
- Transmission repair
- Accident repair
- Electrical repair
- Tire replacement due to damage

Repair records should include:

- Vehicle
- Repair date
- Odometer reading
- Title
- Category
- Description
- Vendor, optional
- Cost
- Warranty date, optional
- Warranty mileage, optional
- Notes
- Attachments

---

### Attachments

V1 supports:

- Photos
- PDFs

Attachments may include:

- Receipts
- Invoices
- Inspection documents
- Warranty documents
- Service photos

Attachment records should anticipate future OCR, but OCR should not be implemented in v1.

Private documents should not be publicly accessible.

---

### Reminders

V1 supports reminders based on:

- Date
- Mileage
- Date or mileage, whichever comes first

Examples:

- Oil change due every 6 months or 5,000 miles
- Registration due on a specific date
- Inspection due by a specific date
- Tire rotation due at a specific mileage

Reminder status should include:

- Upcoming
- Due soon
- Overdue
- Completed

When completing a maintenance reminder, the app should eventually allow the user to create a service record from the reminder.

---

### CSV Export

V1 should support CSV export.

CSV export should include:

- Vehicles
- Odometer entries
- Service records
- Repair records
- Reminders
- Attachment metadata

PDF export is a future feature.

---

## Privacy Positioning

AutoLedger should be designed around this promise:

“Your vehicle records are private. You can use AutoLedger without an account. Cloud sync is optional. We do not sell your data.”

Product requirements:

- Guest mode first
- Optional cloud sync
- No ad tracking SDKs in v1
- No unnecessary location collection
- Export functionality
- Future account/data deletion tools
- Private attachment storage
- Supabase RLS for cloud data

---

## Monetization

Monetization is undecided.

Do not implement payments in v1.

Design with future feature flags so AutoLedger could later support:

- Freemium limits
- Premium cloud sync/storage
- Premium export
- OCR
- VIN lookup
- Household sharing
- Subscription

Possible future flags:

- `ENABLE_CLOUD_SYNC`
- `ENABLE_ATTACHMENTS`
- `ENABLE_CSV_EXPORT`
- `ENABLE_PDF_EXPORT`
- `ENABLE_OCR`
- `ENABLE_VIN_LOOKUP`
- `ENABLE_PREMIUM`
- `ENABLE_HOUSEHOLDS`
- `ENABLE_FUEL_TRACKING`
- `FREE_MAX_VEHICLES`
- `FREE_MAX_ATTACHMENTS`

V1 defaults:

- `ENABLE_CLOUD_SYNC=true`
- `ENABLE_ATTACHMENTS=true`
- `ENABLE_CSV_EXPORT=true`
- `ENABLE_PDF_EXPORT=false`
- `ENABLE_OCR=false`
- `ENABLE_VIN_LOOKUP=false`
- `ENABLE_PREMIUM=false`
- `ENABLE_HOUSEHOLDS=false`
- `ENABLE_FUEL_TRACKING=false`

---

## Mobile Screens

The mobile app should eventually include:

- Onboarding
- Guest home
- Sign in
- Create account
- Dashboard
- Vehicles list
- Vehicle detail
- Add vehicle
- Edit vehicle
- Add odometer entry
- Add service record
- Add repair record
- Record detail
- Add attachment
- Reminders list
- Add reminder
- Settings
- Export data
- Privacy/data controls

---

## Web Routes

The web app should eventually include:

- `/`
- `/features`
- `/pricing`
- `/privacy`
- `/terms`
- `/login`
- `/signup`
- `/dashboard`
- `/vehicles`
- `/vehicles/[vehicleId]`
- `/vehicles/[vehicleId]/records`
- `/vehicles/[vehicleId]/reminders`
- `/settings`
- `/settings/export`
- `/settings/delete-account`
- `/admin`
- `/admin/users`
- `/admin/support`

Admin routes are future-facing and should not be overbuilt during the local guest MVP.

---

## UX Direction

The design should be:

- Professional
- Clean
- Modern
- Trustworthy
- Easy for non-technical users
- Dashboard-oriented but not overwhelming

Mobile UX should use:

- Vehicle cards
- Upcoming reminder indicators
- Timeline/list view for service history
- Quick action buttons
- Clear attachment previews
- Category badges/chips
- Short onboarding
- Clear empty states

Avoid:

- Gimmicky car graphics
- Cluttered dashboards
- Overly technical language
- Pushy account creation
- Premature monetization screens
