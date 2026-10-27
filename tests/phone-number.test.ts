import assert from "node:assert/strict";
import test from "node:test";
import { internationalPhone, registrationPhoneKey, phoneCallingCode } from "../lib/phone-number.ts";

test("country-specific numbers retain their full international identity", () => {
  assert.equal(internationalPhone("9876543210"), "+919876543210");
  assert.equal(internationalPhone("+91 98765 43210"), "+919876543210");
  assert.equal(internationalPhone("07700 900123", "GB"), "+447700900123");
  assert.equal(internationalPhone("50 123 4567", "AE"), "+971501234567");
  assert.equal(internationalPhone("4155552671", "US"), "+14155552671");
  assert.equal(internationalPhone("+65 8123 4567"), "+6581234567");
  assert.equal(internationalPhone("123", "AE"), "");
  assert.equal(internationalPhone("123456789012345678", "US"), "");
  assert.equal(internationalPhone("1234567890", "IN"), "");
  assert.equal(internationalPhone("call +971501234567"), "");
});

test("Indian lookup keys remain compatible and foreign numbers are never truncated", () => {
  assert.equal(registrationPhoneKey("+91 9876543210"), "9876543210");
  assert.equal(registrationPhoneKey("9876543210"), "9876543210");
  assert.equal(registrationPhoneKey("+971501234567"), "+971501234567");
  assert.notEqual(registrationPhoneKey("+6581234567"), registrationPhoneKey("6581234567"));
  assert.notEqual(registrationPhoneKey("+14155552671"), registrationPhoneKey("+914155552671"));
});

test("calling codes use telephone numbering plans rather than area-code descriptions", () => {
  assert.equal(phoneCallingCode("DO"), "1");
  assert.equal(phoneCallingCode("JM"), "1");
  assert.equal(phoneCallingCode("GB"), "44");
  assert.equal(phoneCallingCode("AE"), "971");
});
