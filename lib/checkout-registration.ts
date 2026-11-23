import { recoverCheckoutRegistration } from "./checkout-registration-recovery.ts";
import { getDbPool } from "@/lib/db";
import { readRazorpayEntity } from "@/lib/razorpay-course-checkout";

let schema: Promise<unknown> | undefined;

async function checkoutDatabase() {
  const db = getDbPool();
  if (!db) throw new Error("Checkout database is unavailable.");
  schema ??= db.query(`DO $setup$ BEGIN
    PERFORM pg_advisory_xact_lock(73184, 7);
    CREATE TABLE IF NOT EXISTS cfl_checkout_registrations (
    order_id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL,
    payment_id TEXT UNIQUE,
    completed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ); END $setup$;`).catch(error => {
    schema = undefined;
    throw error;
  });
  await schema;
  return db;
}

export async function saveCheckoutRegistration(orderId: string, registration: Record<string, unknown>, amount: number, currency: string) {
  const db = await checkoutDatabase();
  await db.query(`INSERT INTO cfl_checkout_registrations(order_id,payload,amount,currency)
    VALUES ($1,$2::jsonb,$3,$4)`, [orderId, JSON.stringify(registration), Math.round(amount * 100), currency]);
}

// The browser and webhook use the same durable draft and the same registration
// writer. Its identity lock makes concurrent deliveries safe to retry.
export async function completeCheckoutRegistration(orderId: string, paymentId: string) {
  const db = await checkoutDatabase();
  const result = await db.query("SELECT * FROM cfl_checkout_registrations WHERE order_id=$1", [orderId]);
  const draft = result.rows[0];
  if (!draft) return { skipped: true };
  if (draft.completed_at) {
    if (draft.payment_id !== paymentId) throw new Error("Checkout already completed with another payment.");
    return { skipped: false };
  }
  try {
    await recoverCheckoutRegistration(draft, orderId, paymentId, {
      readPayment: () => readRazorpayEntity(`payments/${encodeURIComponent(paymentId)}`),
      saveRegistration: async (registration) => {
        const { POST: saveRegistration } = await import("@/app/api/public-registration-state/route");
        const response = await saveRegistration(new Request("http://localhost/api/public-registration-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registration })
        }));
        const saved = await response.json();
        return { ...saved, ok: response.ok && saved.ok === true };
      }
    });
    await db.query(`UPDATE cfl_checkout_registrations SET completed_at=NOW(),payment_id=$2,last_error=NULL WHERE order_id=$1`, [orderId, paymentId]);
    return { skipped: false };
  } catch (error) {
    await db.query("UPDATE cfl_checkout_registrations SET last_error=$2 WHERE order_id=$1",
      [orderId, error instanceof Error ? error.message.slice(0, 500) : "Registration recovery failed"]);
    console.error("Paid registration recovery pending", { orderId, paymentId });
    throw error;
  }
}
