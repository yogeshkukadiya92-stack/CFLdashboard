import assert from "node:assert/strict";
import test from "node:test";
import { filterRepeaterWorkshops } from "../lib/repeater-workshops.ts";
import { workshopMatchesSearch } from "../lib/workshop-tags.ts";

test("editing tolerates incomplete historical workshop names without modifying records", () => {
  const records = [
    { id: "editing", name: "Current" },
    { id: "missing" },
    { id: "null", name: null },
    { id: "number", name: 42 },
    { id: "empty", name: "  " },
    { id: "past", name: "Healthy Forever" }
  ];
  assert.deepEqual(filterRepeaterWorkshops(records, "editing", ""), [records[5]]);
  assert.deepEqual(filterRepeaterWorkshops(records, "editing", " FOREVER "), [records[5]]);
  assert.deepEqual(filterRepeaterWorkshops(records, "editing", "absent"), []);
  assert.equal(records.length, 6);
  assert.equal(workshopMatchesSearch({ name: undefined } as never, "healthy"), false);
});
