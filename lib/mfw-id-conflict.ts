export function hasMfwRegistrationIdConflict(entry: {
  registrationNumber?: string;
  mfwSyncStatus?: string;
  mfwSyncError?: string;
}) {
  return entry.mfwSyncStatus === "failed"
    && /^REG-\d+$/.test(entry.registrationNumber || "")
    && Boolean(entry.mfwSyncError?.startsWith(`Unique ID ${entry.registrationNumber} is already assigned to `))
    && Boolean(entry.mfwSyncError?.includes("This row matches "));
}
