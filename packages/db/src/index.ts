export type SyncStatus =
  | "local_only"
  | "pending_upload"
  | "synced"
  | "sync_error";

export type DbCloudDataStatus = {
  developmentTrack: "local_guest_mvp";
  authImplemented: false;
  cloudSyncImplemented: false;
  cloudTablesImplemented: false;
};

export const dbCloudDataStatus: DbCloudDataStatus = {
  developmentTrack: "local_guest_mvp",
  authImplemented: false,
  cloudSyncImplemented: false,
  cloudTablesImplemented: false,
};
