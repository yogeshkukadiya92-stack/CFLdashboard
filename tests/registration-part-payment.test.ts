import assert from "node:assert/strict";
import test from "node:test";
import { configuredPartPayment } from "../lib/registration-part-payment.ts";

test("registration uses the amount saved for its workshop", () => {
  const workshops = [{ id: "other", minimumPartPayment: "500" }, { id: "batch-19", minimumPartPayment: "21000" }];
  assert.equal(configuredPartPayment(workshops, "batch-19", 81000), 21000);
});

test("configured part payment never exceeds the selected fee", () => {
  assert.equal(configuredPartPayment([{ id: "w", minimumPartPayment: "21000" }], "w", 10000), 10000);
});

test("legacy workshops without a valid configured amount keep manual payment", () => {
  for (const value of [undefined, "", "bad", "-10", "0"]) {
    assert.equal(configuredPartPayment([{ id: "w", minimumPartPayment: value }], "w", 81000), 0);
  }
  assert.equal(configuredPartPayment([], "missing", 81000), 0);
});
