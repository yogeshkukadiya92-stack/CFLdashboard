import assert from "node:assert/strict";
import test from "node:test";
import { resolveRazorpayConfig } from "../lib/razorpay-config.ts";

const defaultIntegrationSettings = {
  razorpayEnabled: false,
  razorpayKeyId: "",
  razorpayKeySecret: "",
  razorpayWebhookSecret: ""
};

test("enabled Razorpay settings override stale deployment credentials", () => {
  const config = resolveRazorpayConfig(
    {
      ...defaultIntegrationSettings,
      razorpayEnabled: true,
      razorpayKeyId: "  rzp_live_saved  ",
      razorpayKeySecret: "  saved-secret  ",
      razorpayWebhookSecret: "  saved-webhook  "
    },
    {
      RAZORPAY_KEY_ID: "rzp_live_stale",
      RAZORPAY_KEY_SECRET: "stale-secret",
      RAZORPAY_WEBHOOK_SECRET: "stale-webhook"
    }
  );

  assert.deepEqual(config, {
    keyId: "rzp_live_saved",
    keySecret: "saved-secret",
    webhookSecret: "saved-webhook"
  });
});

test("deployment credentials remain the fallback when saved Razorpay settings are disabled", () => {
  const config = resolveRazorpayConfig(defaultIntegrationSettings, {
    RAZORPAY_KEY_ID: "  rzp_live_environment  ",
    RAZORPAY_KEY_SECRET: "  environment-secret  ",
    RAZORPAY_WEBHOOK_SECRET: "  environment-webhook  "
  });

  assert.deepEqual(config, {
    keyId: "rzp_live_environment",
    keySecret: "environment-secret",
    webhookSecret: "environment-webhook"
  });
});
