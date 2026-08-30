import assert from "node:assert/strict";
import test from "node:test";
import { isMissingPersistenceTableError } from "./db.ts";

test("only a missing app_state table triggers schema initialization on read", () => {
  assert.equal(isMissingPersistenceTableError({ code: "42P01" }), true);
  assert.equal(isMissingPersistenceTableError({ code: "55P03" }), false);
  assert.equal(isMissingPersistenceTableError(new Error("connection timed out")), false);
});
