import assert from "node:assert/strict";
import test from "node:test";
import { resolveRegistrationOtpRequired } from "../lib/registration-otp.ts";

test("an explicit workshop-link OTP setting overrides stale form state", () => {
  assert.equal(resolveRegistrationOtpRequired(false, true), false);
  assert.equal(resolveRegistrationOtpRequired(true, false), true);
});

test("OTP falls back to the saved form only when the link has no setting", () => {
  assert.equal(resolveRegistrationOtpRequired(undefined, true), true);
  assert.equal(resolveRegistrationOtpRequired(undefined, false), false);
  assert.equal(resolveRegistrationOtpRequired(undefined, undefined), false);
});
