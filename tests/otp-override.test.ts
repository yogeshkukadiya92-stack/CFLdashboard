import assert from "node:assert/strict";
import test from "node:test";
import { canUseManualOtpOverride } from "../lib/otp-override.ts";

test("manual OTP override requires an authenticated admin and exact configured code", () => {
  assert.equal(canUseManualOtpOverride({ configuredCode: "850000", isAdmin: true, submittedCode: "850000" }), true);
  assert.equal(canUseManualOtpOverride({ configuredCode: "850000", isAdmin: false, submittedCode: "850000" }), false);
  assert.equal(canUseManualOtpOverride({ configuredCode: "850000", isAdmin: true, submittedCode: "850001" }), false);
});

test("manual OTP override stays disabled when the server code is absent or invalid", () => {
  assert.equal(canUseManualOtpOverride({ configuredCode: undefined, isAdmin: true, submittedCode: "850000" }), false);
  assert.equal(canUseManualOtpOverride({ configuredCode: "85000", isAdmin: true, submittedCode: "850000" }), false);
  assert.equal(canUseManualOtpOverride({ configuredCode: "secret", isAdmin: true, submittedCode: "secret" }), false);
});
