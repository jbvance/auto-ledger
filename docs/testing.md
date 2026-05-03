# AutoLedger Testing

AutoLedger now has an initial lightweight testing foundation. The goal is to
cover high-value product logic without overbuilding Phase 1 infrastructure.

## Tools

- Vitest for pure TypeScript package tests in `packages/shared` and
  `packages/validation`.
- Jest with `jest-expo` for Expo React Native tests in `apps/mobile`.
- React Native Testing Library for user-visible mobile component and screen
  assertions.
- Maestro smoke-flow YAML files in `apps/mobile/e2e/maestro`.

## Commands

Install dependencies after pulling these changes:

```sh
pnpm install
```

Run all tests:

```sh
pnpm test
```

Run pure package unit tests:

```sh
pnpm test:unit
```

Run mobile Jest tests:

```sh
pnpm test:mobile
```

Run unit tests in watch mode:

```sh
pnpm test:watch
```

Run typecheck and lint:

```sh
pnpm typecheck
pnpm lint
```

## Mobile E2E Smoke Tests

The Maestro files are a scaffold only. They are not wired into CI and they do
not install Maestro or manage emulators.

Install Maestro separately, start a simulator/emulator, install or open the app,
then run:

```sh
APP_ID=host.exp.Exponent pnpm e2e:mobile
```

Use the Expo Go app id for Expo Go smoke checks, or replace `APP_ID` with a
development build app id when a dev build exists.

## What Is Tested

- CSV escaping and combined local CSV export shape.
- Maintenance reminder status logic.
- Cloud-compatible maintenance reminder row mapping.
- Cloud-compatible record attachment row mapping.
- Cloud record attachment Storage path generation.
- Guest migration readiness summary counts and local not-started migration run
  storage helpers.
- Vehicle-only migration duplicate prevention, local ID preservation, archived
  vehicle handling, mapping creation, and partial failure behavior with mocked
  Supabase.
- Odometer-only migration local ID preservation, vehicle mapping usage, missing
  vehicle mapping skips, mapping repair on rerun, and cloud vehicle odometer
  recalculation with mocked Supabase.
- Shared odometer recalculation logic used by local and cloud record updates.
- Formatting and unified history ordering helpers.
- Zod validation for vehicles, odometer entries, service records, repair
  records, maintenance reminders, and attachments.
- Mobile dashboard guest empty state.
- Vehicle summary card rendering.
- Maintenance reminder form validation feedback.

## Intentionally Not Tested Yet

- Supabase cloud CRUD integration against a live Supabase project.
- SQLite persistence integration on a device.
- Supabase RLS behavior.
- Notification delivery behavior on real iOS/Android devices.
- Attachment picker/file-copy behavior on real devices.
- Live guest-to-account upload migration against a real Supabase project.
- Guest-to-account service, repair, reminder, and attachment migration.
- Cloud CSV export.
- Live Supabase Storage upload/open/delete integration for cloud attachments.
- Supabase cloud maintenance reminder CRUD integration against a live Supabase
  project.
- Full end-to-end mobile flows in CI.

## Windows and Bitdefender Notes

If tests or installs are slowed, quarantined, or blocked on Windows, add a
trusted Antivirus exception for the repo folder, for example:

```text
C:\Projects\auto-tracker
```

If Bitdefender Advanced Threat Defense blocks trusted developer tools, add
exceptions for the specific executables you use, such as Node, pnpm, VS Code,
Android emulator, ADB, or Maestro.

Do not disable Bitdefender globally. Prefer narrow exceptions for this trusted
repo and trusted development executables.
