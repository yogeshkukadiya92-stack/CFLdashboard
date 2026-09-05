export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.DATABASE_URL && process.env.NEXT_PHASE !== "phase-production-build") {
      const { ensurePersistenceTable, ensureRegistrationRecordsTable } = await import("./lib/db");
      const { ensureRegistrationJobs } = await import("./lib/registration-jobs");
      const { ensureRegistrationHotPath } = await import("./lib/registration-hot-path");
      await ensurePersistenceTable();
      await ensureRegistrationRecordsTable();
      await ensureRegistrationJobs();
      await ensureRegistrationHotPath();
    }
    const { startRegistrationWorker } = await import("./lib/registration-jobs");
    startRegistrationWorker();
  }
}
