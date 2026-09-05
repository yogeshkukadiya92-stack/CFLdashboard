import assert from "node:assert/strict";
import test from "node:test";
import { resolveRegistrationOtpRequired } from "../lib/registration-otp.ts";

test("saved form OTP settings override stale registration-link copies", () => {
  assert.equal(resolveRegistrationOtpRequired(true, false), false);
  assert.equal(resolveRegistrationOtpRequired(false, true), true);
});

test("saved form OTP settings also work without a link setting", () => {
  assert.equal(resolveRegistrationOtpRequired(undefined, true), true);
  assert.equal(resolveRegistrationOtpRequired(undefined, false), false);
  assert.equal(resolveRegistrationOtpRequired(undefined, undefined), false);
});

test("legacy links retain OTP when the form has no explicit setting", () => {
  assert.equal(resolveRegistrationOtpRequired(true, undefined), true);
  assert.equal(resolveRegistrationOtpRequired(false, undefined), false);
});
