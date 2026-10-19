import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/auth';
import { ensureRegistrationRecordsTable, getDbPool } from '@/lib/db';
import { readRazorpayEntity } from '@/lib/razorpay-course-checkout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!(await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value))) return NextResponse.json({error:'Unauthorized'}, {status:401});
  const mobile = request.nextUrl.searchParams.get('mobile') || '';
  if (!/^[6-9]\d{9}$/.test(mobile)) return NextResponse.json({error:'A valid mobile number is required.'}, {status:400});
  const db = getDbPool();
  if (!db) return NextResponse.json({error:'Database unavailable'}, {status:503});
  try {
    await ensureRegistrationRecordsTable();
    const rows = await db.query('SELECT payload FROM cfl_registration_records WHERE mobile_normalized=$1 ORDER BY created_at DESC LIMIT 10', [mobile]);
    const registrations = await Promise.all(rows.rows.map(async ({payload: entry}) => {
      const orderId = entry.answers?.['Razorpay Order ID'];
      const paymentId = entry.answers?.['Razorpay Payment ID'];
      let verification: Record<string, unknown> = {};
      if (/^order_[a-zA-Z0-9]+$/.test(orderId || '') && /^pay_[a-zA-Z0-9]+$/.test(paymentId || '')) {
        try {
          const [order, payment] = await Promise.all([readRazorpayEntity(`orders/${orderId}`), readRazorpayEntity(`payments/${paymentId}`)]);
          verification = {orderStatus:order.status, paymentStatus:payment.status, courseProofPresent:Boolean(order.notes?.mfw_course), orderMatches:payment.order_id === order.id};
        } catch { verification = {error:'Provider verification unavailable'}; }
      }
      return {workshop:entry.workshopTitle, createdAt:entry.createdAt, status:entry.status, orderId, paymentId, ...verification};
    }));
    return NextResponse.json({registrations}, {headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Enrollment check unavailable'}, {status:503}); }
}
