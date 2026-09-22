type RazorpayEnvironment = {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
};

export function resolveRazorpayConfig(
  environment: RazorpayEnvironment = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET
  }
) {
  return {
    keyId: environment.RAZORPAY_KEY_ID?.trim() || "",
    keySecret: environment.RAZORPAY_KEY_SECRET?.trim() || "",
    webhookSecret: environment.RAZORPAY_WEBHOOK_SECRET?.trim() || ""
  };
}
