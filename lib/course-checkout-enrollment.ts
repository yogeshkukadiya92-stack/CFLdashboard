import { createHmac } from 'node:crypto';

type Entity = Record<string, any>;
export async function enrollVerifiedCheckout(orderId: string, paymentId: string, dependencies: {
  read: (path: string) => Promise<Entity>;
  send: (rawBody: string, signature: string) => Promise<{assigned: boolean; skipped: boolean}>;
  secret: string;
}) {
  const [order, payment] = await Promise.all([dependencies.read(`orders/${encodeURIComponent(orderId)}`), dependencies.read(`payments/${encodeURIComponent(paymentId)}`)]);
  if (order.id !== orderId || payment.id !== paymentId || payment.order_id !== orderId) throw new Error('Payment does not belong to this order.');
  if (!order.notes?.mfw_course) return { assigned: false, skipped: true };
  if (!dependencies.secret || !order.notes.mfw_course_signature) throw new Error('Course verification is unavailable.');
  if (order.status !== 'paid' || payment.status !== 'captured' || order.currency !== 'INR' || payment.currency !== 'INR' || !Number.isSafeInteger(order.amount) || order.amount <= 0 || order.amount_paid !== order.amount || order.amount_due !== 0 || payment.amount !== order.amount || Number(payment.amount_refunded || 0) !== 0) throw new Error('Course payment is not fully captured.');
  // Both entities come from Razorpay's authenticated API, never checkout input.
  // MFW also verifies the original server-signed course/buyer proof and mapping.
  const rawBody = JSON.stringify({ event: 'order.paid', payload: { order: {entity: order}, payment: {entity: payment} } });
  const signature = createHmac('sha256', dependencies.secret).update(rawBody).digest('hex');
  const result = await dependencies.send(rawBody, signature);
  if (result.skipped) throw new Error('Course mapping is unavailable.');
  return result;
}
