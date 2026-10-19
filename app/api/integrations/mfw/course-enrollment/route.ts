import { getAppState } from "@/lib/db";
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/auth';
import { getRazorpayConfig } from '@/lib/integrations';
import { courseConnectionKey, mfwCourseRequest, saveCourseConnectionKey, saveLocalCourseEnrollmentSettings } from '@/lib/mfw-course-connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const authorized = (request: NextRequest) => verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
async function razorpayLink(id: string) {
  const { keyId, keySecret } = await getRazorpayConfig();
  if (!keyId || !keySecret) throw new Error('Configure Razorpay credentials on the CFL server first.');
  const response = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(id)}`, { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.id !== id || result.currency !== 'INR') throw new Error(`Payment link ${id} is unavailable in this Razorpay account.`);
  return result;
}
export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const config = await getRazorpayConfig();
  const webhookUrl = 'https://dashboard.coachforlife.in/api/webhooks/razorpay';
  try {
    const state = await getAppState();
    const registrationLinks = Object.values(state?.registrationLinks || {}).filter((value): value is { id: string; title: string; slug: string; paid: boolean } => Boolean(value && typeof value === 'object' && (value as {paid?: unknown}).paid)).map(value => ({ id: `registration:${value.id}`, title: value.title, url: `https://dashboard.coachforlife.in/register/${value.slug}` }));
    const connected = Boolean(await courseConnectionKey());
    const result = connected ? await mfwCourseRequest('course-enrollment') : null;
    return NextResponse.json({ registrationLinks, connected, razorpayReady: Boolean(config.keyId && config.keySecret), webhookSecretReady: Boolean(config.webhookSecret), webhookUrl, ...(result?.data || { enabled: false, courses: [], mappings: [] }) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Connection failed', webhookUrl }, { status: 502 }); }
}
export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = await request.json();
    const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
    if (apiKey) {
      if (apiKey.length < 24 || apiKey.length > 512) throw new Error('Enter a valid MFW API key.');
      await mfwCourseRequest('course-enrollment', {}, apiKey);
      await saveCourseConnectionKey(apiKey);
    }
    if (input.action === 'connect') return NextResponse.json({ ok: true });
    if (typeof input.enabled !== 'boolean' || !Array.isArray(input.mappings) || input.mappings.length > 500) throw new Error('Invalid course mappings.');
    const seen = new Set<string>();
    for (const row of input.mappings) {
      if (!(/^(?:plink_[a-zA-Z0-9]+|registration:[a-zA-Z0-9_-]+)$/.test(row.paymentLinkId || '')) || !/^[a-f0-9]{24}$/i.test(row.courseId || '') || seen.has(row.paymentLinkId)) throw new Error('Choose a course and a unique Razorpay Payment Link ID for each row.');
      seen.add(row.paymentLinkId);
      if (row.paymentLinkId.startsWith('registration:')) {
        const state = await getAppState();
        if (!Object.values(state?.registrationLinks || {}).some(value => value && typeof value === 'object' && (value as {paid?: unknown}).paid && `registration:${(value as {id?: unknown}).id}` === row.paymentLinkId)) throw new Error('Select an existing paid CFL registration link.');
      } else await razorpayLink(row.paymentLinkId);
    }
    const { webhookSecret } = await getRazorpayConfig();
    if (input.enabled && !webhookSecret) throw new Error('RAZORPAY_WEBHOOK_SECRET is missing from the CFL server.');
    await mfwCourseRequest('course-enrollment', { method: 'PUT', body: JSON.stringify({ enabled: input.enabled, mappings: input.mappings, webhookSecret }) });
    await saveLocalCourseEnrollmentSettings({ enabled: input.enabled, mappings: input.mappings });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save course enrollment' }, { status: 400 }); }
}
