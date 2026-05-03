# AutoLedger Production Readiness and Security Audit

Date: 2026-05-03

Scope: documentation and code review only. No fixes, behavior changes, data deletion, or schema changes were implemented as part of this audit.

## 1. Executive Summary

Overall readiness level: pre-production beta candidate, not launch-ready.

AutoLedger has a strong v1 foundation: guest mode is functional, optional Supabase Auth exists, cloud CRUD is implemented on mobile and web, private Storage is used for service/repair attachments, manual guest-to-account migration is implemented, and account/data controls avoid unsafe cloud deletion. The architecture generally follows `AGENTS.md` and the privacy-first product direction.

The main gap is not feature volume; it is production hardening. The highest-risk areas are running the live Supabase RLS and Storage verification package against a production-like project, safe server-only cloud/account deletion, production auth configuration, attachment cleanup/idempotency under real failures, and launch/deployment documentation.

Biggest launch blockers:

1. Supabase RLS and Storage verification docs/scripts now exist, but they have not yet been run and recorded against a live production-like project.
2. Full cloud data deletion and Supabase Auth account deletion are planned but not implemented.
3. Production Auth redirect/email confirmation settings are not documented or tested.
4. Attachment deletion/upload failure paths can leave orphaned Storage objects that require operational recovery.
5. App launch documentation is incomplete for production env vars, Supabase project separation, Expo/EAS, privacy/terms, and support/contact flows.

Recommended next 5 fixes in order:

1. Run and record the Supabase live verification checklist for RLS, table grants, Storage bucket privacy, signed URLs, and cross-user access denial.
2. Implement server-only cloud data deletion dry run/counts, keeping `SUPABASE_SERVICE_ROLE_KEY` out of mobile and browser code.
3. Document production environment setup, including Supabase redirect URLs, email confirmation behavior, web/mobile env files, and dev/prod project separation.
4. Harden and test attachment cleanup/idempotency, especially metadata failure after upload and parent record deletion with multiple attachments.
5. Add launch docs/pages for privacy policy, terms, support/contact, Expo/EAS build setup, and production release checklist.

## 2. Environment and Secrets Audit

Observed files and patterns:

- Root example env: `.env.example`
- Mobile example env: `apps/mobile/.env.example`
- Web example env: `apps/web/.env.example`
- Mobile env handling: `apps/mobile/lib/supabase.ts`
- Web env handling: `apps/web/lib/supabase/config.ts`
- Shared validation: `packages/config/src/index.ts`, `packages/validation/src/index.ts`
- Git ignore rules: `.gitignore`

Findings:

- Mobile and browser code use public anon keys only: `EXPO_PUBLIC_SUPABASE_*` and `NEXT_PUBLIC_SUPABASE_*`.
- A search for `SUPABASE_SERVICE_ROLE_KEY` found only docs/examples, not app runtime code.
- `.env`, `.env.*`, and local app env files are ignored by `.gitignore`.
- `.env.example` is safe and contains placeholders.
- `apps/mobile/.env.example` is tracked and safe.
- `apps/web/.env.example` exists locally but is ignored/untracked because `.gitignore` ignores `.env.*` and only unignores root `.env.example`. Current docs mention `apps/web/.env.example`, so this is documentation/repo drift.
- `validateMobileEnv` and `validateWebEnv` allow missing public Supabase values, which supports optional cloud setup in dev. This is reasonable, but production deployment should fail fast if required cloud features are expected.

Risks:

- Production deployment could accidentally run with missing Supabase public env vars and show unconfigured states instead of failing during release validation.
- The ignored web env example can disappear from source control, making setup less reproducible.

Recommendations:

- Track `apps/web/.env.example` by updating `.gitignore` or moving app-local examples to non-ignored names.
- Add `docs/production-env.md` or a deployment section documenting required production variables for web, mobile, and future server-only deletion.
- Add a release check that production builds have Supabase URL/anon key configured.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and absent from all `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` variables.

## 3. Supabase Auth Audit

Relevant code:

- Mobile auth provider: `apps/mobile/lib/auth.tsx`
- Mobile Supabase client/session storage: `apps/mobile/lib/supabase.ts`
- Mobile auth screens: `apps/mobile/app/auth/sign-in.tsx`, `apps/mobile/app/auth/sign-up.tsx`
- Web auth screens: `apps/web/app/login/page.tsx`, `apps/web/app/signup/page.tsx`
- Web SSR/browser clients: `apps/web/lib/supabase/server.ts`, `apps/web/lib/supabase/client.ts`
- Web session refresh proxy: `apps/web/lib/supabase/proxy.ts`, `apps/web/proxy.ts`
- Protected web shell/prompts: `apps/web/components/AccountPageChrome.tsx`

Findings:

- Mobile uses Supabase session persistence through AsyncStorage and handles invalid refresh token cleanup.
- Mobile starts/stops Supabase token refresh around app foreground/background state.
- Web uses `@supabase/ssr` server/browser clients and a proxy to refresh sessions.
- Web account pages render sign-in prompts when unauthenticated rather than exposing data.
- Web server actions derive the authenticated user through `getWebCloudAuthState`.
- Sign-up handles the case where email confirmation is required by showing a message.
- Password reset, magic link, OAuth, recent reauthentication, and MFA are not implemented. That is acceptable for current v1 scope, but account deletion will require stronger confirmation or recent auth.

Risks:

- Production redirect URLs and Supabase Site URL settings are not documented.
- Email confirmation assumptions are copy-only; there is no documented test matrix for projects with confirmation enabled versus disabled.
- Web `/dashboard`, `/vehicles`, and `/settings` do not redirect unauthenticated users; they render prompts. This is fine, but should be intentional and documented.
- Some auth copy still says cloud records "save to your account" while local records remain on device. This is mostly accurate, but signed-in mobile mode can make local records less visible, so copy should continue to emphasize where local data can be found/migrated.

Recommendations:

- Document required Supabase Auth URL configuration for production web URL, Expo deep links if needed later, and email confirmation settings.
- Add manual auth test cases for sign-up with confirmation on/off, sign-in, sign-out, stale refresh token cleanup, and web session refresh.
- Before implementing destructive cloud/account deletion, require recent reauthentication or typed confirmation plus session verification.

## 4. Database and RLS Audit

Relevant SQL:

- `packages/db/sql/001_profiles_auth_foundation.sql`
- `packages/db/sql/002_cloud_data_schema_rls.sql`
- `packages/db/sql/004_verify_local_id_unique_constraints.sql`
- `packages/db/sql/005_verify_live_supabase_security.sql`
- `docs/database-model.md`
- `docs/supabase-cloud-schema.md`
- `docs/supabase-live-verification.md`

User-owned cloud tables:

- `public.profiles`
- `public.vehicles`
- `public.vendors`
- `public.odometer_entries`
- `public.service_records`
- `public.repair_records`
- `public.maintenance_reminders`
- `public.record_attachments`

Findings:

- RLS is enabled for every user-owned public table in the SQL files.
- Policies use `auth.uid() = user_id` or, for profiles, `auth.uid() = id`.
- SQL grants table access to `authenticated`, not `anon`.
- Child tables use owner-scoped foreign keys such as `(vehicle_id, user_id)` references to prevent cross-user parent linking.
- `user_id + local_id` unique constraints exist in the current SQL for migrated entities.
- `004_verify_local_id_unique_constraints.sql` provides a read-only verification query for the critical migration duplicate-prevention constraints.
- `005_verify_live_supabase_security.sql` and `docs/supabase-live-verification.md` now provide a live-project verification package for expected tables, RLS, policies, constraints, foreign keys, indexes, private Storage bucket settings, and Storage policies. This package is read-only and still must be run manually in each Supabase environment.
- Most product table foreign keys use `on delete restrict`, which is safer for avoiding accidental cascades but requires carefully ordered account deletion.
- Indexes exist for common user/vehicle/date access patterns.

Risks:

- Live Supabase projects created before constraint additions may not receive missing constraints from `create table if not exists`; the verification SQL must be run.
- RLS policies are simple owner checks and appear correct, but they are not covered by automated live integration tests.
- `vendors` exists with RLS and constraints but app-side vendor CRUD is deferred; this is acceptable but should be included in deletion flows.
- `record_attachments.storage_bucket` and `storage_path` can be null in schema, though cloud app flows expect them for file-backed cloud attachments. This supports metadata flexibility but requires careful deletion handling.
- Restrictive deletes mean account deletion must delete children and Storage objects before deleting the auth user.

Recommendations:

- Run and record `docs/supabase-live-verification.md` and `packages/db/sql/005_verify_live_supabase_security.sql` before beta.
- Add live RLS tests or manual SQL checks with two users to prove cross-user select/update/delete failures.
- Run `004_verify_local_id_unique_constraints.sql` in every Supabase environment.
- For account deletion, keep service-role code server-only and explicitly scope every delete by the verified user ID.

## 5. Supabase Storage Audit

Relevant code/SQL:

- Storage SQL: `packages/db/sql/003_record_attachments_storage_rls.sql`
- Live verification SQL: `packages/db/sql/005_verify_live_supabase_security.sql`
- Shared path builder: `packages/shared/src/index.ts`
- Mobile cloud attachments: `apps/mobile/lib/cloudRecordAttachments.ts`
- Web cloud attachments: `apps/web/lib/cloud/recordAttachmentData.ts`
- Web open routes: `apps/web/app/vehicles/[vehicleId]/**/attachments/[attachmentId]/open/route.ts`
- Manual checklist: `docs/supabase-live-verification.md`

Findings:

- `record-attachments` bucket is configured as private.
- Allowed MIME types are limited to JPEG, PNG, WebP, GIF, and PDF.
- Bucket file size limit is 25 MB.
- Storage object RLS scopes select/insert/update/delete to authenticated users whose user ID matches the first path segment.
- App-generated paths start with `{userId}/vehicles/{vehicleId}/...`.
- Storage path segments are sanitized.
- Mobile and web create signed URLs for private file opening with a 10-minute lifetime.
- Upload flows create Storage objects first, then insert metadata, and attempt Storage cleanup if metadata insert fails.
- Service/repair record deletion attempts to delete related attachment Storage objects and metadata before deleting parent records.
- A read-only verification script and manual checklist now exist for bucket privacy, Storage policy presence, suspicious public/anon Storage policies, signed URL usage, and cross-user denial checks. Live execution still needs to be performed and recorded.

Risks:

- If Storage upload succeeds but metadata insert cleanup fails, an orphaned object may remain.
- If file deletion succeeds but metadata deletion fails, metadata can point to a missing file.
- If metadata deletion succeeds but Storage deletion fails in future flows, private orphaned files may remain.
- CSV export includes attachment `storage_path`. This is not a public URL, but it reveals private object path structure and file names. Consider whether this is acceptable for user-owned export.
- Current Storage policies only validate first path segment ownership, not that the nested vehicle/record IDs match database rows. The app does that before upload, and RLS prevents metadata cross-linking, but direct client Storage access could still create arbitrary objects under the user's own folder. That is usually acceptable, but cleanup tooling should account for it.

Recommendations:

- Add an admin/support recovery checklist for orphaned private Storage objects.
- Add tests around cleanup failure status and parent deletion with multiple attachments.
- Consider an operational reconciliation script/report that compares `record_attachments.storage_path` to objects under each user folder.
- Decide whether cloud CSV export should include full `storage_path` or a less revealing attachment locator.

## 6. Local Guest Data Audit

Relevant code:

- SQLite schema: `apps/mobile/lib/database.ts`
- Local CRUD helpers: `apps/mobile/lib/vehicles.ts`, `odometerEntries.ts`, `serviceRecords.ts`, `repairRecords.ts`, `maintenanceReminders.ts`, `recordAttachments.ts`
- Local data detection: `apps/mobile/lib/localGuestData.ts`
- Local deletion: `apps/mobile/lib/localDataControls.ts`
- Mobile data controls screen: `apps/mobile/app/settings/data.tsx`

Findings:

- Guest data is stored in local SQLite database `autoledger_guest.db`.
- Local records include `id`, `local_id`, timestamps, and `sync_status`.
- Guest mode works without Supabase configuration or login.
- Local attachments are copied into app-controlled document storage where possible; PDFs must copy and verify before metadata is saved.
- Local data deletion is typed-confirmation gated with `DELETE LOCAL DATA`.
- Local deletion cancels scheduled local reminder notifications, deletes SQLite rows in a safe order, and attempts to remove app-owned local attachment files.
- Local deletion does not delete cloud account data.
- Migration copies local data and does not delete local rows or local files.

Risks:

- Signed-in mobile mode shows cloud records as the primary mode. Local guest data remains available through migration/data controls, but users may think records disappeared after sign-in.
- Local SQLite data is not encrypted at rest by the app. This may be acceptable for v1, but should be explicitly considered for sensitive receipts/documents.
- Local attachment fallback can preserve original local photo URI when copying fails, which may point outside app-owned storage and cannot be deleted by local cleanup.

Recommendations:

- Keep reinforcing local/cloud separation in signed-in UI.
- Consider a future "View local guest records" affordance for signed-in users if confusion appears in testing.
- Document local storage privacy limitations in privacy policy/support docs.
- Track local attachment cleanup failures and communicate them clearly.

## 7. Guest-to-Account Migration Audit

Relevant docs/code:

- Plan: `docs/guest-to-account-migration-plan.md`
- Core status/mapping helpers: `apps/mobile/lib/guestMigration.ts`
- Review/retry UX: `apps/mobile/lib/guestMigrationReview.ts`, `apps/mobile/app/settings/migration.tsx`
- Entity migrations:
  - `apps/mobile/lib/guestVehicleMigration.ts`
  - `apps/mobile/lib/guestOdometerMigration.ts`
  - `apps/mobile/lib/guestServiceRecordMigration.ts`
  - `apps/mobile/lib/guestRepairRecordMigration.ts`
  - `apps/mobile/lib/guestMaintenanceReminderMigration.ts`
  - `apps/mobile/lib/guestAttachmentMigration.ts`

Findings:

- Migration is manual and focused by entity type.
- Mapping tables are local-only: `migration_runs` and `migration_entity_mappings`.
- Migrations preserve local `local_id`.
- Cloud duplicate prevention is based on `user_id + local_id`.
- Vehicles include archived vehicles.
- Child entities require vehicle mappings.
- Attachments require vehicle and service/repair parent mappings.
- Attachment migration uses deterministic private Storage paths.
- Local records and local files are not deleted on migration success or failure.
- Review/status/retry UX reports counts, readiness, blocked steps, skipped items, failures, and local retention messaging.
- Odometer/service/repair migrations recalculate affected cloud vehicle odometers using cloud rows only.

Entity-specific notes:

- Vehicle migration preserves archived state and maps local vehicles to cloud UUIDs.
- Odometer migration skips entries whose vehicle mapping is missing and recalculates cloud odometers.
- Service migration preserves vendor name text, cost, notes, timestamps, and skips missing vehicle mapping.
- Repair migration preserves warranty fields and skips missing vehicle mapping.
- Reminder migration preserves completed state and does not copy local scheduled notification IDs.
- Attachment migration uploads files before metadata insert, reports missing local files, and attempts cleanup on metadata failures.

Risks:

- `guestVehicleMigration.ts` accepts a `userId` but does not explicitly assert that the currently authenticated Supabase user matches it. Other migration helpers do this. RLS should prevent cross-account writes, but local mapping state could become confusing if this helper were called incorrectly.
- Existing live projects must verify unique constraints before relying on idempotency.
- Attachment migration has inherent two-phase risk: Storage upload and metadata insert can diverge.
- The product spec describes a prompt with "Sync now / Not now / Review records first"; current implementation uses Settings-based review/status/retry flows instead of a full automatic prompt. This is reasonable and safer, but docs/product copy should stay aligned.

Recommendations:

- Add the same authenticated-user assertion to vehicle migration in a focused fix.
- Run `004_verify_local_id_unique_constraints.sql` in all environments.
- Add live migration dry-run/manual verification with real Supabase and sample local data.
- Update product/spec wording if the Settings-based migration UX is the chosen v1 approach.

## 8. Web App Audit

Relevant areas:

- App routes: `apps/web/app`
- Cloud data helpers: `apps/web/lib/cloud`
- Supabase SSR: `apps/web/lib/supabase`
- Account shell: `apps/web/components/AccountPageChrome.tsx`

Findings:

- Web account pages are cloud-only and do not read mobile local guest data.
- Protected pages check auth state server-side and render sign-in prompts when unauthenticated.
- Dashboard, vehicle list/detail, vehicle create/edit/archive/restore, odometer CRUD, service CRUD, repair CRUD, reminder CRUD, attachment upload/open/delete, and CSV export are implemented.
- Web mutations use server actions and scope operations by authenticated `userId`.
- Web open attachment routes verify auth and record ownership before redirecting to a signed URL.
- CSV export route returns `401` when unauthenticated and sets `cache-control: private, no-store`.
- Loading pages exist for dashboard, vehicles, and export.
- Error and empty states are present in major account views.

Risks:

- There are no `/privacy` or `/terms` routes despite product spec route list.
- There is no support/contact flow visible in web app.
- Server Actions body size limit is 30 MB, while Storage bucket allows up to 25 MB. This is aligned but should be reviewed for Vercel limits and user feedback on slow/large uploads.
- Mobile responsiveness appears considered through Tailwind classes, but no Playwright/mobile viewport verification is documented.
- Web cloud deletion/account deletion is inactive; this is safer than unsafe deletion, but not launch-complete for privacy controls.

Recommendations:

- Add launch-required privacy, terms, and support/contact pages.
- Add Playwright smoke tests or manual screenshots for core responsive web routes.
- Add Vercel deployment notes, production env requirements, and upload-size expectations.

## 9. Mobile App Audit

Relevant areas:

- Expo Router screens: `apps/mobile/app`
- Components: `apps/mobile/components`
- Local/cloud helpers: `apps/mobile/lib`
- Expo config: `apps/mobile/app.json`

Findings:

- Guest mode is first-class and does not require login.
- Signed-in mobile mode saves new vehicles/records/reminders/attachments to cloud.
- Local and cloud helpers are separate.
- Vehicle, odometer, service, repair, reminder, attachment, export, migration, settings, and account/data controls are implemented.
- Local reminder notifications are optional and local-only.
- Cloud push notifications are explicitly not implemented.
- Expo app has icon, adaptive icon, splash image, scheme, and notification plugin configured.
- Maestro smoke YAML files exist as a scaffold.

Risks:

- No EAS build configuration was found in the inspected files.
- No production bundle identifiers/package names were visible in `app.json`.
- Expo Go has known notification limitations; final notification behavior should be tested in a development or production build.
- App store privacy disclosures, privacy policy URL, support URL, and terms are not implemented/documented.
- Local SQLite/device persistence and attachment picker/copy behavior are not covered by automated device tests.

Recommendations:

- Add EAS build config and production bundle IDs/package names before app-store beta.
- Test local notifications, file pickers, PDF handoff, and local attachment deletion on real iOS/Android builds.
- Add store metadata/privacy checklist docs.

## 10. Account/Data Deletion Audit

Relevant docs/code:

- Plan: `docs/account-data-deletion-plan.md`
- Mobile local deletion: `apps/mobile/lib/localDataControls.ts`, `apps/mobile/app/settings/data.tsx`
- Web inactive cloud deletion UI: `apps/web/components/AccountDataControls.tsx`

What is implemented:

- Mobile typed-confirmation deletion for local guest data on the current device.
- Local deletion cancels local notifications, deletes local SQLite rows, and attempts app-owned attachment file deletion.
- Web settings explains cloud versus local data and links cloud CSV export.
- Web cloud/account deletion control is disabled and labeled as planned.

What is planned:

- Server-only cloud data deletion dry run/counts.
- Server-only cloud data deletion.
- Supabase Auth account deletion through Admin API/service role.
- Storage object cleanup for private attachments.

Safety assessment:

- No unsafe one-click cloud deletion is exposed.
- No service role key is exposed in client/mobile code.
- Local deletion is appropriately confirmation-gated.
- The destructive cloud path remains a launch blocker if account deletion is required for release/compliance expectations.

Required server-only design:

- Verify current session using anon-key session.
- Derive user ID from verified session, not client input.
- Use service-role key only in a trusted server runtime.
- Dry run first with counts and Storage object count.
- Delete Storage objects before metadata/auth user deletion.
- Scope every service-role query by verified user ID.
- Stop on Storage deletion failures before deleting the Auth user.

Recommended implementation slices:

1. Cloud deletion dry-run route/action with counts only.
2. Server-only cloud data deletion with Storage cleanup and table delete ordering.
3. Account deletion after cloud data deletion succeeds.
4. UI confirmation flow with export-first messaging and typed confirmation.
5. Tests for service-role isolation and partial failure behavior.

## 11. Testing Audit

Relevant docs/config:

- `docs/testing.md`
- Root scripts in `package.json`
- Mobile Jest config: `apps/mobile/jest.config.js`
- Mobile Jest setup/mocks: `apps/mobile/jest.setup.ts`
- Tests under `packages/shared`, `packages/validation`, `apps/mobile`, and `apps/web`
- Maestro scaffold: `apps/mobile/e2e/maestro`

Existing test coverage includes:

- Shared CSV escaping/export shape.
- Reminder status logic.
- Odometer recalculation and history ordering.
- Validation schemas.
- Mobile dashboard and form behavior.
- Local data controls and cleanup ordering.
- Guest migration summaries, mappings, duplicate prevention, retry/status logic.
- Cloud attachment path generation and mocked upload/metadata cleanup behavior.
- Web cloud mappers, mutations, server data helpers, export helpers, and account controls.

Important missing tests before launch:

- Live Supabase RLS cross-user tests.
- Live Supabase Storage upload/open/delete tests.
- Live guest-to-account migration against a real Supabase project.
- Device SQLite persistence tests.
- Real iOS/Android file picker and attachment copy/open tests.
- Real local notification scheduling/cancellation tests.
- Web Playwright smoke tests for auth-gated flows and responsive layouts.
- Maestro flows beyond launch/add-vehicle scaffold.
- Production build smoke tests for Expo/EAS and Next.js.

Commands:

```sh
pnpm typecheck
pnpm lint
pnpm test
```

## 12. Documentation Audit

Findings:

- `docs/current-status.md` is the strongest source of truth and appears mostly aligned with implementation.
- `docs/testing.md` accurately documents current test coverage and gaps.
- `docs/guest-to-account-migration-plan.md` is detailed and mostly aligned with implementation.
- `docs/account-data-deletion-plan.md` accurately states cloud/account deletion is planned and inactive.
- `docs/database-model.md` remains useful as intended model documentation.
- `docs/phases.md` has drift: it says account/data privacy controls are still deferred in one current-status note, while implementation and `docs/current-status.md` show the foundation is complete.
- `AGENTS.md` supplied in the prompt also says account/data privacy controls are next candidate slices, while current implementation has the foundation complete.
- `apps/web/.env.example` exists locally but appears ignored/untracked, while docs reference it.
- Missing setup docs for production deployment, Auth redirects/email confirmation, Vercel, EAS, Supabase dev/prod separation, privacy/terms/support, and release checklist.

Recommendations:

- Update roadmap/status docs to reflect account/data privacy controls foundation completion.
- Ensure web env example is tracked or adjust docs.
- Add production setup and release checklist docs.
- Keep `docs/current-status.md` as the source of truth after each focused slice.

## 13. Deployment Readiness Audit

Web/Vercel:

- Next.js app exists and has build/start scripts.
- Supabase SSR client and session proxy are implemented.
- No Vercel deployment documentation was found.
- Required production env vars are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Future server-only deletion will require `SUPABASE_SERVICE_ROLE_KEY` only in server runtime.

Expo/EAS/mobile:

- Expo app config exists with icons/splash assets.
- No EAS config was found.
- Production bundle identifiers/package names were not visible in inspected config.
- Required mobile env vars are `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Local notifications need final build/device testing.

Supabase:

- SQL setup files exist.
- Dev/prod project separation is not documented.
- RLS/Storage verification must be run in every environment.
- Auth redirect/email confirmation settings need production documentation.

Legal/support:

- Product spec lists `/privacy` and `/terms`, but routes were not present.
- Support/contact flow was not visible.
- Store privacy metadata and data deletion commitments are not documented in release form.

Recommendation:

- Treat deployment readiness as incomplete until production env docs, Supabase verification, Vercel/EAS setup, privacy/terms/support, and release checklist exist.

## 14. Risk Register

| risk | severity | affected area | recommended fix | suggested Codex task name |
| --- | --- | --- | --- | --- |
| RLS policies not live-verified against two users | high | Supabase database | Run/record existing live RLS verification checklist and SQL script | `verify-supabase-rls-prod-readiness` |
| Private Storage policies not live-verified | high | Supabase Storage | Run/record existing upload/open/delete and cross-user denial checks | `verify-storage-privacy-prod-readiness` |
| Cloud/account deletion not implemented | high | Privacy/account controls | Implement server-only dry run, then deletion flow | `cloud-account-deletion-dry-run` |
| Service role key needed for deletion but no server-only implementation exists | high | Secrets/backend | Add server-only route/action with strict session-derived user scoping | `server-only-service-role-deletion-foundation` |
| Attachment upload/metadata/delete failures can leave orphaned objects or stale metadata | high | Attachments/Storage | Harden cleanup, reconciliation, and failure reporting | `harden-attachment-cleanup-idempotency` |
| Production Auth redirect/email confirmation settings undocumented | high | Auth/deployment | Document and manually test production Auth configuration | `document-production-auth-configuration` |
| Vehicle migration lacks explicit signed-in-user assertion | medium | Migration | Add authenticated-user assertion matching other migration helpers | `harden-vehicle-migration-account-assertion` |
| Live Supabase projects may miss `user_id + local_id` constraints | medium | Migration/database | Run verification SQL in every environment and add patch guidance | `verify-local-id-unique-constraints` |
| `apps/web/.env.example` is ignored/untracked while referenced by docs | medium | Env/docs | Adjust `.gitignore` or docs so setup examples are reproducible | `fix-web-env-example-tracking` |
| Signed-in mobile mode can obscure local guest records | medium | Mobile UX/data separation | Improve copy or add a local-data access affordance later | `clarify-signed-in-local-data-ux` |
| CSV export includes private Storage path metadata | medium | Export/privacy | Decide whether to keep, redact, or replace Storage paths | `review-attachment-csv-storage-paths` |
| No privacy/terms/support routes | medium | Launch/legal/web | Add launch-required static pages and support contact | `add-privacy-terms-support-pages` |
| No EAS config or production bundle IDs found | medium | Mobile deployment | Add EAS production build configuration | `add-eas-production-build-config` |
| No live device tests for SQLite/files/notifications | medium | Mobile QA | Add manual checklist and targeted device smoke tests | `mobile-device-readiness-checklist` |
| No Playwright web smoke tests | low | Web QA | Add auth-gated route and responsive smoke tests | `add-web-playwright-smoke-tests` |
| Docs drift in phases/AGENTS-style status | low | Documentation | Align roadmap docs with current status | `align-status-and-roadmap-docs` |

## 15. Recommended Fix Roadmap

Security and data-loss first:

1. `verify-supabase-rls-prod-readiness`
   - Run `docs/supabase-live-verification.md` and `packages/db/sql/005_verify_live_supabase_security.sql` against the live dev project.
   - Record two-user select/insert/update/delete denial checks.
   - Run `004_verify_local_id_unique_constraints.sql`.

2. `verify-storage-privacy-prod-readiness`
   - Use `docs/supabase-live-verification.md` to verify private bucket config, object RLS, signed URLs, cross-user denial, and upload/delete behavior.
   - Confirm no public URLs are used.

3. `cloud-account-deletion-dry-run`
   - Add server-only authenticated dry-run counts for tables and Storage objects.
   - Do not delete data in this slice.
   - Keep service role key server-only.

4. `harden-attachment-cleanup-idempotency`
   - Add focused tests and, if needed, implementation hardening for upload cleanup failure, delete failure, retry behavior, and parent deletion.

5. `harden-vehicle-migration-account-assertion`
   - Add explicit authenticated-user verification to vehicle migration.
   - Match existing odometer/service/repair/reminder/attachment migration patterns.

Launch configuration next:

6. `document-production-auth-configuration`
   - Document Supabase Site URL, redirect URLs, email confirmation assumptions, and manual auth tests.

7. `fix-web-env-example-tracking`
   - Ensure `apps/web/.env.example` is tracked or update setup docs to use root `.env.example` only.

8. `add-production-deployment-docs`
   - Cover Vercel, Expo/EAS, Supabase dev/prod separation, production env vars, release checks, and rollback notes.

9. `add-privacy-terms-support-pages`
   - Add minimal launch pages/routes and support/contact guidance.

10. `add-mobile-release-config`
   - Add EAS config, production bundle IDs/package names, and build profile docs.

Testing and polish:

11. `add-web-playwright-smoke-tests`
   - Cover unauthenticated prompts, signed-in dashboard, vehicle detail, export route, and responsive viewport smoke checks.

12. `mobile-device-readiness-checklist`
   - Cover real device SQLite persistence, attachments, PDFs, local notifications, sign-in/out, migration, and local deletion.

13. `review-attachment-csv-storage-paths`
   - Decide whether exported attachment metadata should include `storage_path`.

14. `align-status-and-roadmap-docs`
   - Update `docs/phases.md`, `AGENTS.md` guidance if applicable, and any stale current-priority copy.

## Final Audit Position

AutoLedger is architecturally sound for a privacy-first guest/mobile-first MVP, but it should not be launched as production-ready until Supabase RLS/Storage are verified live, deletion/account controls have a server-only path, production Auth/deployment configuration is documented, and attachment cleanup/migration risks are hardened through focused tests and manual verification.
