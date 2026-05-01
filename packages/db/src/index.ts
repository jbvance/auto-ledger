export type SyncStatus =
  | "local_only"
  | "pending_upload"
  | "synced"
  | "sync_error";

export type DbFoundationStatus = {
  phase: "foundation";
  cloudTablesImplemented: false;
};

export const dbFoundationStatus: DbFoundationStatus = {
  phase: "foundation",
  cloudTablesImplemented: false,
};
