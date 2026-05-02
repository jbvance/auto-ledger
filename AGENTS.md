# AGENTS.md

## Project Overview

AutoLedger is a mobile-first vehicle maintenance, repair, mileage, document, and reminder tracking app for families and individuals with multiple vehicles.

The primary product is an Expo React Native mobile app for iOS and Android. A Next.js web app will provide the same core user features on the web, plus marketing pages and future admin/support tools.

AutoLedger should feel professional, privacy-conscious, reliable, and simple enough for non-technical users.

For broader product context, consult:

- `docs/product-spec.md`
- `docs/database-model.md`
- `docs/phases.md`

Do not implement future-phase features unless explicitly instructed.

---

## Locked Architecture

Use this architecture unless the user explicitly changes it:

- Monorepo: pnpm workspaces
- Mobile app: Expo React Native
- Mobile routing: Expo Router
- Web app: Next.js App Router
- Backend: Supabase
- Database: Supabase Postgres
- Auth: Supabase Auth
- Storage: Supabase Storage
- Mobile styling: NativeWind
- Web styling: Tailwind CSS and shadcn/ui
- Language: TypeScript throughout
- Forms: React Hook Form
- Validation: Zod
- Server/client state: TanStack Query where useful
- Charts on web: Recharts
- Package manager: pnpm

Recommended structure:

- `apps/mobile`
- `apps/web`
- `packages/shared`
- `packages/validation`
- `packages/config`
- `packages/db`
- `packages/ui-tokens`

---

## Non-Negotiable Product Requirements

- Mobile-first experience.
- Guest mode is required in v1.
- Account creation is optional and used for cloud sync.
- Do not require login before users can add vehicles or records locally.
- Use Supabase for authenticated cloud data.
- Use Supabase Row Level Security for every user-owned cloud table.
- Support photos and PDFs as attachments in v1.
- Support date-based and mileage-based reminders in v1.
- Support CSV export in v1.
- Preserve a strong privacy posture.
- Do not collect unnecessary location data.
- Do not add ad tracking SDKs in v1.
- Do not hardcode secrets.
- Do not expose Supabase service role keys to mobile or browser code.

---

## Explicit Non-Goals for v1

Do not build these unless the user specifically asks later:

- Capacitor wrapper around Next.js
- Required account before using the app
- Household invitations or shared family accounts
- Fuel fill-up tracking
- VIN lookup
- OCR extraction from receipts or PDFs
- Paid subscriptions
- In-app purchases
- Ads
- PDF export
- Complex offline conflict resolution
- Fleet/business management features
- Auto shop/service-provider portal

The data model may anticipate some future features, but the UI and workflows should not implement them yet.

---

## Current Build Priority

Build in focused slices. Do not attempt the whole product at once.

Current development track: Local guest MVP features, optional Supabase Auth foundation, Supabase cloud schema/RLS foundation, mobile cloud vehicle CRUD, and mobile cloud odometer entry CRUD are complete; broader app-side cloud sync is next.

Working local guest features include vehicle management, odometer entries, service records, repair records, unified history/timeline, dashboard polish, core maintenance reminders, local reminder notification settings/code, local service/repair attachments, and local CSV export. Optional Supabase account sign-up/sign-in/sign-out exists. Signed-in mobile users can create/list/view/edit/archive/restore cloud vehicles and create/list/edit/delete cloud odometer entries for those cloud vehicles.

Treat `docs/current-status.md` as the source of truth for current implementation status.

Do not implement broader cloud sync beyond the explicitly requested slice, guest-to-account migration, Supabase Storage/cloud attachments, or other future-facing features unless explicitly instructed.

---

## Coding Standards

- Use TypeScript everywhere.
- Keep strict typing enabled.
- Prefer small, focused components.
- Avoid large files where possible.
- Avoid `any` unless there is a strong reason.
- Use Zod schemas for user-input validation.
- Put shared validation schemas in `packages/validation`.
- Put reusable domain logic in `packages/shared`.
- Put database-related helpers/types in `packages/db`.
- Keep mobile and web UI separate unless sharing is clearly beneficial.
- Prefer clear code over clever abstractions.
- Do not introduce unnecessary dependencies.
- Do not invent commands without adding them to the relevant `package.json`.

---

## Security Rules

- Never commit `.env` files.
- Never hardcode secrets.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to mobile or browser code.
- Use public anon Supabase keys only where appropriate.
- Use RLS for all user-owned cloud records.
- Store user files in user-scoped storage paths.
- Validate file type and size before upload.
- Avoid logging sensitive user data.
- Avoid logging receipt contents or private attachment URLs.

---

## Environment Variables

Expected variables may include:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Rules:

- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- Mobile and browser code must use anon keys with RLS.
- Add environment validation where practical.

---

## Commands

Prefer root commands such as:

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`

App-specific commands may include:

- `pnpm --filter mobile dev`
- `pnpm --filter web dev`
- `pnpm --filter mobile lint`
- `pnpm --filter web lint`
- `pnpm --filter mobile typecheck`
- `pnpm --filter web typecheck`

If a command does not exist, add it to the appropriate `package.json` before relying on it.

---

## Testing Expectations

Use practical testing.

Prioritize tests for:

- Shared validation schemas
- Reminder due-date and mileage logic
- CSV export logic
- Guest-to-account migration logic
- Critical form validation

Recommended tools:

- Vitest for shared packages
- Playwright later for web flows
- Maestro or Detox later for mobile flows

Do not overbuild testing infrastructure during Phase 1.

---

## Agent Working Rules

When making changes:

1. Inspect existing files before editing.
2. Make focused changes matching the current phase.
3. Do not introduce architecture changes without explicit instruction.
4. Do not add non-v1 features unless requested.
5. Preserve guest mode and privacy requirements.
6. Reuse shared schemas and types where appropriate.
7. Run lint/typecheck/tests when possible.
8. Explain any skipped or failed checks.
9. Provide complete file contents when replacing an entire file.
10. Be explicit about file paths and commands.

---

## User Collaboration Preference

The user prefers practical, step-by-step guidance.

When completing a task:

- Explain what changed.
- Provide commands to run.
- Identify the next recommended step.
- Pause at major checkpoints if asked.
