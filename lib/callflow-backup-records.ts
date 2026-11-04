export const BACKUP_TABLES = ["leads", "calls", "call_events", "notes", "follow_ups", "sync_events", "app_configuration", "lead_stages", "dispositions", "call_dispositions", "sync_conflicts"] as const;
export type BackupRecord = { table: string; id: string; updatedAt: number; row: Record<string, unknown> };
export function validateBackupRecords(value: unknown): BackupRecord[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("BACKUP_BATCH_LIMIT");
  if (Buffer.byteLength(JSON.stringify(value)) > 1024 * 1024) throw new Error("BACKUP_BATCH_TOO_LARGE");
  return value.map((item: BackupRecord) => {
    if (!item || !BACKUP_TABLES.includes(item.table as typeof BACKUP_TABLES[number]) || typeof item.id !== "string" || !item.id || item.id.length > 300) throw new Error("INVALID_BACKUP_RECORD");
    if (!item.row || Array.isArray(item.row) || typeof item.row !== "object" || String(item.row[item.table === "app_configuration" ? "key" : "id"]) !== item.id) throw new Error("INVALID_BACKUP_ROW");
    if (!Number.isSafeInteger(item.updatedAt) || item.updatedAt < 0 || Buffer.byteLength(JSON.stringify(item.row)) > 64 * 1024) throw new Error("INVALID_BACKUP_VERSION");
    if (Object.values(item.row).some(value => value !== null && !["string", "number", "boolean"].includes(typeof value))) throw new Error("INVALID_BACKUP_FIELD");
    return { table: item.table, id: item.id, updatedAt: item.updatedAt, row: item.row };
  });
}
