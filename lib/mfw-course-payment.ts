import { mfwCourseRequest } from "./mfw-course-connection.ts";
// Server only: preserve Razorpay's exact signed bytes across retries.
export async function syncCoursePaymentToMfw(rawBody: string, signature: string) {
  try {
    const result = await mfwCourseRequest('course-payments/cfl', { method: 'POST', body: JSON.stringify({ rawBody, signature }) });
    if (!result.skipped && !result.data?.courseAssigned) throw new Error('Missing course assignment');
    return { assigned: Boolean(result.data?.courseAssigned), skipped: Boolean(result.skipped) };
  } catch {
    throw new Error('MFW course assignment is pending; retry the payment event.');
  }
}
