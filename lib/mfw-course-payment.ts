// Server only: relay the exact signed bytes, never a browser's payment status.
export async function syncCoursePaymentToMfw(rawBody: string, signature: string) {
  const baseUrl = String(process.env.MFW_API_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = String(process.env.MFW_INTEGRATION_API_KEY || "").trim();
  if (!baseUrl || !apiKey) throw new Error("MFW course integration is not configured.");
  const response = await fetch(`${baseUrl}/integrations/v1/course-payments/cfl`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mfw-api-key": apiKey },
    body: JSON.stringify({ rawBody, signature }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store"
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success || (!result.skipped && !result.data?.courseAssigned)) {
    throw new Error("MFW course assignment is pending; retry the payment event.");
  }
  return { assigned: Boolean(result.data?.courseAssigned), skipped: Boolean(result.skipped) };
}
