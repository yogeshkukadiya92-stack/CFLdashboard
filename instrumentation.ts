export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRegistrationWorker } = await import("./lib/registration-jobs");
    startRegistrationWorker();
  }
}
