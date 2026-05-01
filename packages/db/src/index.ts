export type SyncStatus =
  | "local_only"
  | "pending_upload"
  | "synced"
  | "sync_error";

export type DbCloudDataStatus = {
  developmentTrack: "local_guest_mvp";
  authFoundationImplemented: true;
  cloudSyncImplemented: false;
  cloudTablesImplemented: false;
  profilesSqlDocumented: true;
};

export const dbCloudDataStatus: DbCloudDataStatus = {
  developmentTrack: "local_guest_mvp",
  authFoundationImplemented: true,
  cloudSyncImplemented: false,
  cloudTablesImplemented: false,
  profilesSqlDocumented: true,
};
