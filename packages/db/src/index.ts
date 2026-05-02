export type SyncStatus =
  | "local_only"
  | "pending_upload"
  | "synced"
  | "sync_error";

export type DbCloudDataStatus = {
  developmentTrack: "local_guest_cloud_vehicle_odometer_service_foundation";
  authFoundationImplemented: true;
  broaderCloudRecordSyncImplemented: false;
  cloudOdometerCrudImplemented: true;
  cloudServiceRecordCrudImplemented: true;
  cloudVehicleCrudImplemented: true;
  cloudTablesImplemented: true;
  cloudSchemaRlsImplemented: true;
  guestToAccountMigrationImplemented: false;
  profilesSqlDocumented: true;
  storageImplemented: false;
};

export const dbCloudDataStatus: DbCloudDataStatus = {
  developmentTrack: "local_guest_cloud_vehicle_odometer_service_foundation",
  authFoundationImplemented: true,
  broaderCloudRecordSyncImplemented: false,
  cloudOdometerCrudImplemented: true,
  cloudServiceRecordCrudImplemented: true,
  cloudVehicleCrudImplemented: true,
  cloudTablesImplemented: true,
  cloudSchemaRlsImplemented: true,
  guestToAccountMigrationImplemented: false,
  profilesSqlDocumented: true,
  storageImplemented: false,
};

export const dbSqlFiles = [
  "packages/db/sql/001_profiles_auth_foundation.sql",
  "packages/db/sql/002_cloud_data_schema_rls.sql",
] as const;
