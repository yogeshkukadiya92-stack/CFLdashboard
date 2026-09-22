type RazorpaySettings = {
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
};

type RazorpayEnvironment = {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
};

export function resolveRazorpayConfig(
  settings: RazorpaySettings,
  environment: RazorpayEnvironment = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET
  }
) {
  const savedKeyId = settings.razorpayKeyId.trim();
  const savedKeySecret = settings.razorpayKeySecret.trim();
  const useSavedCredentials = settings.razorpayEnabled && Boolean(savedKeyId) && Boolean(savedKeySecret);

  return {
    keyId: useSavedCredentials ? savedKeyId : environment.RAZORPAY_KEY_ID?.trim() || savedKeyId,
    keySecret: useSavedCredentials ? savedKeySecret : environment.RAZORPAY_KEY_SECRET?.trim() || savedKeySecret,
    webhookSecret: settings.razorpayEnabled
      ? settings.razorpayWebhookSecret.trim() || environment.RAZORPAY_WEBHOOK_SECRET?.trim() || ""
      : environment.RAZORPAY_WEBHOOK_SECRET?.trim() || settings.razorpayWebhookSecret.trim()
  };
}
