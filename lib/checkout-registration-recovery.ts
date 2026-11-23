type Payment = {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  amount_refunded?: number;
};

export async function recoverCheckoutRegistration(
  draft: { payload: Record<string, unknown>; amount: number; currency: string },
  orderId: string,
  paymentId: string,
  dependencies: {
    readPayment: () => Promise<Payment>;
    saveRegistration: (registration: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; registration?: { answers?: Record<string, string> } }>;
  }
) {
  const payment = await dependencies.readPayment();
  if (payment.id !== paymentId || payment.order_id !== orderId || payment.status !== "captured"
    || Number(payment.amount) !== Number(draft.amount) || payment.currency !== draft.currency
    || Number(payment.amount_refunded || 0) !== 0) {
    throw new Error("Registration payment has not been fully captured.");
  }
  const registration = {
    ...draft.payload,
    amountPaid: Number(draft.amount) / 100,
    answers: { ...(draft.payload.answers as Record<string, unknown> | undefined), "Razorpay Order ID": orderId, "Razorpay Payment ID": paymentId }
  };
  const saved = await dependencies.saveRegistration(registration);
  if (!saved.ok) throw new Error(saved.error || "Paid registration could not be saved.");
  if (saved.registration?.answers?.["Razorpay Order ID"] !== orderId) {
    throw new Error("Registration identity is already used by another checkout.");
  }
  return saved;
}
