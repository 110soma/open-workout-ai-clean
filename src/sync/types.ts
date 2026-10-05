export type SyncStatus = "local_only" | "pending" | "syncing" | "synced" | "conflict" | "error";

export interface SyncableRecord {
  id: string;
  sync_status: SyncStatus;
  dirty: boolean;
  local_updated_at: string;
  server_updated_at: string | null;
}

export interface SyncPushResult {
  id: string;
  server_updated_at: string;
}

/** Local-First UIとクラウド実装を分離する同期境界。 */
export interface CloudSyncGateway<T extends SyncableRecord> {
  push(records: T[]): Promise<SyncPushResult[]>;
  pull(since: string | null): Promise<T[]>;
}
