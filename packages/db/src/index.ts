export type SyncStatus =
  | "local_only"
  | "pending_upload"
  | "synced"
  | "sync_error";

export type DbCloudDataStatus = {
  developmentTrack: "local_guest_cloud_vehicle_record_reminder_attachment_migration_foundation";
  authFoundationImplemented: true;
  broaderCloudRecordSyncImplemented: false;
  cloudMaintenanceReminderCrudImplemented: true;
  cloudOdometerCrudImplemented: true;
  cloudRepairRecordCrudImplemented: true;
  cloudServiceRecordCrudImplemented: true;
  cloudVehicleCrudImplemented: true;
  cloudTablesImplemented: true;
  cloudSchemaRlsImplemented: true;
  guestToAccountMigrationImplemented: false;
  guestToAccountVehicleMigrationImplemented: true;
  profilesSqlDocumented: true;
  storageImplemented: true;
  storageSqlDocumented: true;
  guestToAccountOdometerMigrationImplemented: true;
  guestToAccountServiceRecordMigrationImplemented: true;
  guestToAccountRepairRecordMigrationImplemented: true;
  guestToAccountMaintenanceReminderMigrationImplemented: true;
  guestToAccountAttachmentMigrationImplemented: true;
};

export const dbCloudDataStatus: DbCloudDataStatus = {
  developmentTrack:
    "local_guest_cloud_vehicle_record_reminder_attachment_migration_foundation",
  authFoundationImplemented: true,
  broaderCloudRecordSyncImplemented: false,
  cloudMaintenanceReminderCrudImplemented: true,
  cloudOdometerCrudImplemented: true,
  cloudRepairRecordCrudImplemented: true,
  cloudServiceRecordCrudImplemented: true,
  cloudVehicleCrudImplemented: true,
  cloudTablesImplemented: true,
  cloudSchemaRlsImplemented: true,
  guestToAccountMigrationImplemented: false,
  guestToAccountVehicleMigrationImplemented: true,
  profilesSqlDocumented: true,
  storageImplemented: true,
  storageSqlDocumented: true,
  guestToAccountOdometerMigrationImplemented: true,
  guestToAccountServiceRecordMigrationImplemented: true,
  guestToAccountRepairRecordMigrationImplemented: true,
  guestToAccountMaintenanceReminderMigrationImplemented: true,
  guestToAccountAttachmentMigrationImplemented: true,
};

export const dbSqlFiles = [
  "packages/db/sql/001_profiles_auth_foundation.sql",
  "packages/db/sql/002_cloud_data_schema_rls.sql",
  "packages/db/sql/003_record_attachments_storage_rls.sql",
  "packages/db/sql/004_verify_local_id_unique_constraints.sql",
  "packages/db/sql/005_verify_live_supabase_security.sql",
] as const;
