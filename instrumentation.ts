export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.DATABASE_URL && process.env.NEXT_PHASE !== "phase-production-build") {
      const { ensurePersistenceTable, ensureRegistrationRecordsTable } = await import("./lib/db");
      const { ensureRegistrationJobs } = await import("./lib/registration-jobs");
      const { ensureRegistrationHotPath } = await import("./lib/registration-hot-path");
      try {
        await ensurePersistenceTable();
        await ensureRegistrationRecordsTable();
        await ensureRegistrationJobs();
        await ensureRegistrationHotPath();
      } catch (error) {
        // Next can keep listening after register() fails, returning 500 for
        // every request. Exit so the supervised launcher replaces this worker
        // and retries initialization instead of leaving a poisoned server up.
        console.error("Database startup failed; restarting web process", error);
        process.exit(1);
      }
    }
    const { startRegistrationWorker } = await import("./lib/registration-jobs");
    startRegistrationWorker();
    const { startAttendanceThankYouWorker } = await import("./lib/attendance-thank-you");
    startAttendanceThankYouWorker();
  }
}
