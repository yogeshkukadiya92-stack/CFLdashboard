import assert from "node:assert/strict";
import test from "node:test";
import { parseBulkAttendanceMobiles } from "../lib/bulk-attendance.ts";

test("bulk attendance accepts Indian mobile formats and removes duplicates", () => {
  const result = parseBulkAttendanceMobiles("98765 43210\n+91 87654 32109,9876543210");
  assert.deepEqual(result.mobiles, ["9876543210", "8765432109"]);
  assert.deepEqual(result.invalid, []);
});

test("bulk attendance reports invalid values and applies its safety limit", () => {
  const result = parseBulkAttendanceMobiles("12345\n9876543210\n8765432109", 1);
  assert.deepEqual(result.mobiles, ["9876543210"]);
  assert.deepEqual(result.invalid, ["12345"]);
});
