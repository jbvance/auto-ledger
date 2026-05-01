# AutoLedger Development Phases

Build AutoLedger in phases.

Do not ask Codex to “build the whole app” in one request. Ask it to complete one phase or one slice of a phase at a time.

Current status note: This roadmap remains useful as a planning reference, but development has not followed the original phase order exactly. Local reminders, local attachments for service/repair records, and local CSV export were completed before Supabase auth, cloud sync, and Supabase Storage. Supabase Auth foundation now exists, but cloud record sync and guest-to-account migration are still deferred. Treat `docs/current-status.md` as the source of truth for what is currently working.

---

## Phase 1: Monorepo and Foundation

Goal: Establish the project structure and development environment.

Build:

- pnpm workspace
- Expo mobile app in `apps/mobile`
- Next.js web app in `apps/web`
- Shared packages:
  - `packages/shared`
  - `packages/validation`
  - `packages/config`
  - `packages/db`
  - `packages/ui-tokens`
- TypeScript configuration
- Linting
- Formatting
- Basic environment validation
- Basic design tokens
- Basic navigation shells

Definition of done:

- `pnpm install` works.
- Mobile app runs locally.
- Web app runs locally.
- Shared package imports work.
- TypeScript builds.
- Lint passes.
- No Supabase auth or database feature is required yet.

Do not build yet:

- Auth
- Cloud sync
- Attachments
- Reminders
- CSV export
- Admin tools

---

## Phase 2: Guest Mode Core Records

Goal: Let a guest user use the mobile app locally without an account.

Build:

- Local guest storage
- Add vehicle
- Edit vehicle
- Vehicle list
- Vehicle detail
- Add odometer entry
- Add service record
- Add repair record
- Basic dashboard with vehicle cards
- Empty states
- Basic form validation using shared Zod schemas

Definition of done:

- User can open the mobile app without signing in.
- User can create a vehicle.
- User can add mileage, service, and repair records.
- Records persist locally.
- UI remains usable after app restart.
- Guest mode is not treated as a secondary feature.

Do not build yet:

- Supabase auth
- Cloud migration
- Attachments
- Reminders
- CSV export

---

## Phase 3: Supabase Auth and Cloud Data

Goal: Add optional account creation and authenticated cloud records.

Build:

- Supabase setup
- Sign up
- Sign in
- Sign out
- Auth session handling
- Base Supabase tables
- RLS policies
- Cloud save/load for authenticated users
- Basic profile record

Definition of done:

- Guest mode still works.
- Authenticated users can save cloud records.
- Users cannot read or modify other users’ data.
- Supabase service role key is never exposed to mobile or browser code.

Do not build yet:

- Complex offline conflict resolution
- Household sharing
- Payments
- OCR
- VIN lookup

---

## Phase 4: Guest-to-Account Migration

Goal: Allow a guest user to sign up and sync existing local records.

Build:

- Detect local guest records after sign-in/sign-up
- Migration prompt
- Upload local vehicles and records to Supabase
- Preserve local IDs
- Handle errors clearly
- Allow user to defer migration

Definition of done:

- A guest can create local records, create an account, and upload records.
- Migration does not create obvious duplicate records.
- User is not forced to migrate immediately.
- Failed migration gives understandable feedback.

---

## Phase 5: Attachments

Goal: Support photos and PDFs attached to service/repair records.

Build:

- Photo picker
- PDF/document picker
- Attachment metadata
- Supabase Storage integration for authenticated users
- Local attachment references for guest users where feasible
- Secure file access
- Attachment previews or clear file rows

Definition of done:

- User can add photos and PDFs to service/repair records.
- Attachment metadata is saved.
- Private files are not publicly exposed.
- Data model includes future OCR fields.
- OCR is not implemented.

---

## Phase 6: Reminders

Goal: Support date and mileage reminders.

Build:

- Add reminder
- Edit reminder
- Complete reminder
- Date-based reminders
- Mileage-based reminders
- Date-or-mileage reminders
- Upcoming reminders on dashboard
- Overdue status
- Reminder utility functions in shared package
- Unit tests for reminder logic

Definition of done:

- User can create reminders tied to vehicles.
- User can tell what is due soon or overdue.
- Reminder status works for date and mileage.
- Completing a reminder is supported.
- Reminder calculations are tested.

---

## Phase 7: CSV Export

Goal: Allow users to export meaningful vehicle records.

Build:

- CSV generation utilities
- Export vehicles
- Export odometer entries
- Export service records
- Export repair records
- Export reminders
- Export attachment metadata
- Mobile export/share flow where practical
- Web export page

Definition of done:

- User can export CSV data.
- CSV output is structured and readable.
- Export works for guest data where feasible.
- Export works for authenticated data.
- PDF export is not implemented.

---

## Phase 8: Web Dashboard

Goal: Provide the same core user features on web.

Build:

- Web login/signup
- Web dashboard
- Vehicle list
- Vehicle detail
- Records views
- Reminder views
- Settings/export pages
- Responsive web UI
- Recharts where useful for costs/mileage

Definition of done:

- Authenticated users can access their vehicle data on web.
- Web UI is professional and responsive.
- Web app uses shared validation/types where practical.
- Web does not diverge unnecessarily from mobile domain logic.

---

## Phase 9: Launch Polish

Goal: Prepare for beta testing and future app-store submission.

Build:

- App icon
- Splash screen
- Loading states
- Error states
- Empty states
- Accessibility pass
- Privacy page
- Terms page
- Account/data deletion plan
- App Store metadata draft
- Google Play metadata draft
- Basic support/admin scaffolding if needed

Definition of done:

- App feels polished enough for beta testing.
- Privacy posture is reflected in UI and docs.
- Core user flows are stable.
- No obvious placeholder UI remains in core flows.

---

## Recommended Codex Prompt Pattern

Use prompts like this:

“Please complete Phase 1 only from `docs/phases.md`. Follow `AGENTS.md`. Do not implement auth, Supabase tables, attachments, reminders, or CSV export yet. Create the monorepo, Expo app, Next.js app, shared packages, basic TypeScript/lint configuration, and simple placeholder screens. Provide the commands I should run.”

For later phases, use the same pattern:

“Please complete Phase 2 only…”

or

“Please implement only the Add Vehicle flow from Phase 2…”

Smaller prompts will produce better results than broad prompts.
