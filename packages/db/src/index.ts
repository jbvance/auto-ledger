export type SyncStatus =
  | "local_only"
  | "pending_upload"
  | "synced"
  | "sync_error";

export type DbCloudDataStatus = {
  developmentTrack: "local_guest_cloud_schema_foundation";
  authFoundationImplemented: true;
  cloudSyncImplemented: false;
  cloudTablesImplemented: true;
  cloudSchemaRlsImplemented: true;
  profilesSqlDocumented: true;
  storageImplemented: false;
};

export const dbCloudDataStatus: DbCloudDataStatus = {
  developmentTrack: "local_guest_cloud_schema_foundation",
  authFoundationImplemented: true,
  cloudSyncImplemented: false,
  cloudTablesImplemented: true,
  cloudSchemaRlsImplemented: true,
  profilesSqlDocumented: true,
  storageImplemented: false,
};

export const dbSqlFiles = [
  "packages/db/sql/001_profiles_auth_foundation.sql",
  "packages/db/sql/002_cloud_data_schema_rls.sql",
] as const;
