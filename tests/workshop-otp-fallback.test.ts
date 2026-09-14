import assert from "node:assert/strict";
import test from "node:test";
import { createWorkshopOtpFallbackHash, verifyWorkshopOtpFallbackHash } from "../lib/workshop-otp-fallback.ts";

test("workshop fallback OTP is bound to its form and exact code", () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-only-workshop-otp-secret";
  try {
    const hash = createWorkshopOtpFallbackHash("form-workshop-38-main", "850011");
    assert.equal(verifyWorkshopOtpFallbackHash("form-workshop-38-main", "850011", hash), true);
    assert.equal(verifyWorkshopOtpFallbackHash("form-workshop-38-main", "850012", hash), false);
    assert.equal(verifyWorkshopOtpFallbackHash("form-another-workshop", "850011", hash), false);
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});
