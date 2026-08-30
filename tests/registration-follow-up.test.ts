import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/api/admin/registration-follow-up/route.ts", import.meta.url), "utf8");

test("confirmation runs MFW and WhatsApp provider calls in parallel", () => {
  const parallelBlock = source.match(/await Promise\.all\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.match(parallelBlock, /syncConfirmedRegistrationToMfw/);
  assert.match(parallelBlock, /sendRegistrationConfirmation/);
});
