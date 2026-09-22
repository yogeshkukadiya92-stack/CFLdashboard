import assert from "node:assert/strict";
import test from "node:test";
import { resolveRazorpayConfig } from "../lib/razorpay-config.ts";

test("Razorpay credentials are read only from the server environment", () => {
  const config = resolveRazorpayConfig({
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

test("missing server credentials never fall back to website settings", () => {
  assert.deepEqual(resolveRazorpayConfig({}), { keyId: "", keySecret: "", webhookSecret: "" });
});
