import { getRazorpayConfig } from './integrations';
import { enrollVerifiedCheckout } from './course-checkout-enrollment';
import { syncCoursePaymentToMfw } from './mfw-course-payment';

export async function readRazorpayEntity(path: string) {
  const {keyId, keySecret} = await getRazorpayConfig();
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured.');
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {headers: {Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`}, signal: AbortSignal.timeout(10000), cache: 'no-store'});
  if (!response.ok) throw new Error('Could not retrieve the verified Razorpay payment.');
  return response.json();
}
export async function assignVerifiedCourseCheckout(orderId: string, paymentId: string) {
  const {webhookSecret} = await getRazorpayConfig();
  return enrollVerifiedCheckout(orderId, paymentId, {read: readRazorpayEntity, send: syncCoursePaymentToMfw, secret: webhookSecret || ''});
}
