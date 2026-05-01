# AutoLedger Database Model

This document describes the intended v1 data model.

The app should support guest/local records first and authenticated Supabase cloud records later.

The data model should anticipate future features such as OCR, VIN lookup, households, and PDF export, but those features should not be implemented in v1 unless specifically requested.

---

## General Conventions

Most user-owned tables should include:

- `id`
- `user_id`
- `local_id`
- `created_at`
- `updated_at`
- `sync_status`

Possible `sync_status` values:

- `local_only`
- `pending_upload`
- `synced`
- `sync_error`

Use Supabase Row Level Security for all user-owned cloud records.

---

## profiles

Represents an authenticated user profile.

Suggested fields:

- `id`
- `user_id`
- `full_name`
- `email`
- `timezone`
- `units_preference`
- `created_at`
- `updated_at`

Notes:

- `user_id` should correspond to the Supabase auth user.
- Profiles are for authenticated users only.

---

## vehicles

Represents one vehicle owned or tracked by the user.

Suggested fields:

- `id`
- `user_id`
- `local_id`
- `nickname`
- `make`
- `model`
- `year`
- `trim`
- `vin`
- `license_plate`
- `license_state`
- `color`
- `vehicle_type`
- `current_odometer`
- `odometer_unit`
- `purchase_date`
- `purchase_odometer`
- `notes`
- `archived_at`
- `created_at`
- `updated_at`
- `sync_status`

Notes:

- `vin` is optional in v1.
- Do not implement VIN lookup in v1.
- `archived_at` allows a user to hide a sold/inactive vehicle without deleting records.
- `local_id` is useful for guest-created records later migrated to cloud.

---

## odometer_entries

Represents mileage or odometer history.

Suggested fields:

- `id`
- `user_id`
- `vehicle_id`
- `local_id`
- `reading`
- `reading_date`
- `odometer_unit`
- `source_type`
- `notes`
- `created_at`
- `updated_at`
- `sync_status`

Possible `source_type` values:

- `manual`
- `service_record`
- `repair_record`
- `reminder_completion`
- `import`

---

## service_records

Represents routine service events.

Suggested fields:

- `id`
- `user_id`
- `vehicle_id`
- `local_id`
- `service_date`
- `odometer_reading`
- `title`
- `category`
- `description`
- `vendor_id`
- `cost_amount`
- `cost_currency`
- `notes`
- `created_at`
- `updated_at`
- `sync_status`

Possible categories:

- `oil_change`
- `tire_rotation`
- `inspection`
- `registration`
- `brakes`
- `battery`
- `fluids`
- `scheduled_maintenance`
- `tires`
- `other`

---

## repair_records

Represents non-routine repairs.

Suggested fields:

- `id`
- `user_id`
- `vehicle_id`
- `local_id`
- `repair_date`
- `odometer_reading`
- `title`
- `category`
- `description`
- `vendor_id`
- `cost_amount`
- `cost_currency`
- `warranty_until_date`
- `warranty_until_odometer`
- `notes`
- `created_at`
- `updated_at`
- `sync_status`

Possible categories:

- `engine`
- `transmission`
- `electrical`
- `brakes`
- `suspension`
- `body`
- `tires`
- `hvac`
- `diagnostic`
- `other`

---

## maintenance_reminders

Represents upcoming maintenance, renewal, inspection, warranty, or custom reminders.

Suggested fields:

- `id`
- `user_id`
- `vehicle_id`
- `local_id`
- `title`
- `category`
- `reminder_type`
- `due_date`
- `due_odometer`
- `repeat_interval_months`
- `repeat_interval_miles`
- `is_completed`
- `completed_at`
- `last_triggered_at`
- `notes`
- `created_at`
- `updated_at`
- `sync_status`

Reminder types:

- `date`
- `mileage`
- `date_or_mileage`

Possible categories:

- `oil_change`
- `tire_rotation`
- `inspection`
- `registration`
- `insurance`
- `warranty`
- `battery`
- `brakes`
- `custom`

Reminder logic should be implemented in shared utility functions and tested.

---

## record_attachments

Represents photos, PDFs, and future OCR metadata.

Suggested fields:

- `id`
- `user_id`
- `vehicle_id`
- `service_record_id`
- `repair_record_id`
- `local_id`
- `file_name`
- `file_type`
- `mime_type`
- `file_size_bytes`
- `storage_bucket`
- `storage_path`
- `local_uri`
- `ocr_status`
- `ocr_text`
- `ocr_vendor`
- `ocr_processed_at`
- `created_at`
- `updated_at`
- `sync_status`

Possible `file_type` values:

- `photo`
- `pdf`

Possible `ocr_status` values for future use:

- `not_started`
- `pending`
- `processed`
- `failed`

Notes:

- OCR fields exist for future use only.
- Do not build OCR in v1.
- Attachments should be associated with service or repair records in v1.
- Vehicle-level attachments may be added later.

---

## vendors

Represents mechanics, dealerships, inspection stations, tire shops, or other service providers.

Suggested fields:

- `id`
- `user_id`
- `local_id`
- `name`
- `phone`
- `email`
- `website`
- `address_line_1`
- `address_line_2`
- `city`
- `state`
- `postal_code`
- `country`
- `notes`
- `created_at`
- `updated_at`
- `sync_status`

Notes:

- Vendors are optional.
- Avoid requiring vendor creation when adding a service/repair record.
- A simple text vendor name may be enough in early UI, but the schema can support structured vendors later.

---

## notification_preferences

Represents notification settings for reminders.

Suggested fields:

- `id`
- `user_id`
- `vehicle_id`
- `reminder_id`
- `notify_by_push`
- `notify_by_email`
- `notify_days_before`
- `notify_miles_before`
- `created_at`
- `updated_at`

Notes:

- Push notifications are most relevant to mobile.
- Email notifications can be future-facing.
- Do not overbuild notification infrastructure in Phase 1.

---

## Future Tables Not in V1

These may be useful later, but should not be implemented in v1 unless specifically requested.

### households

Would support shared family accounts.

### household_members

Would support inviting spouses/family members.

### fuel_entries

Would support fuel fill-up tracking.

### subscriptions

Would support premium plans.

### ocr_jobs

Would support asynchronous OCR processing.

### vehicle_documents

Would support vehicle-level documents unrelated to a specific service or repair record.

---

## RLS Expectations

Every user-owned cloud table should have RLS enabled.

Basic expectation:

- A user can select only their own records.
- A user can insert only records owned by themselves.
- A user can update only their own records.
- A user can delete only their own records.

When households are added later, RLS can be expanded to support household membership.

Do not weaken RLS to make development easier.
