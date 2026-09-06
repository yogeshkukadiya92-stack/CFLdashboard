import test from "node:test";
import assert from "node:assert/strict";
import { executeWorkflow } from "../lib/workflow-engine.ts";

test("attendance workshop and form scope prevents downstream execution", () => {
  const result = executeWorkflow({
    nodes: [
      { id: "event", kind: "attendance", title: "Attendance submitted", subtitle: "", x: 0, y: 0, config: { event: "Attendance submitted", workshopId: "selected", sessionIds: ["form-1"] } },
      { id: "assign", kind: "crm", title: "Assign sales person", subtitle: "", x: 1, y: 0, config: {} }
    ],
    connections: [{ id: "edge", from: "event", to: "assign" }],
    registration: { workshopId: "different", attendanceSessionId: "form-1" }, salesPeople: [], leads: []
  });
  assert.deepEqual(result.steps.map((step) => step.status), ["skipped", "skipped"]);
  assert.equal(result.assignment, undefined);
});
