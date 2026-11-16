type PaymentEntry = { status: string; amountPaid: number; amountDue: number };
type WorkshopPricing = { isPaid: boolean; paymentUnknown?: boolean };

// Legacy free registrations use "Paid" to mean that no balance is owed.
// Preserve stored payment data while showing the actual workshop pricing.
export function registrationPaymentLabel(entry: PaymentEntry, workshop?: WorkshopPricing | null): string {
  if (workshop?.isPaid === false && !workshop.paymentUnknown && entry.amountPaid === 0 && entry.amountDue === 0) return "Free";
  return entry.status;
}
