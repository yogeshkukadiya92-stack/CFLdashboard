import test from "node:test";
import assert from "node:assert/strict";
import { isHealthyForeverWorkshop } from "../lib/healthy-forever.ts";

test("recognizes every Healthy Forever workshop naming variant", () => {
  assert.equal(isHealthyForeverWorkshop("Healthy Forever 38"), true);
  assert.equal(isHealthyForeverWorkshop("Free Introduction Session of 'Healthy Forever' Workshop"), true);
  assert.equal(isHealthyForeverWorkshop("  HEALTHY-FOREVER Batch 39  "), true);
});

test("does not enable medical reports for unrelated workshops", () => {
  assert.equal(isHealthyForeverWorkshop("Unleash Your Potential"), false);
  assert.equal(isHealthyForeverWorkshop("Healthy Habits Forever"), false);
});
