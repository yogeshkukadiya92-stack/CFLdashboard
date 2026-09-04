import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkflowImport, workflowTemplates } from "../lib/workflow-templates.ts";
import { workflowMatchesTriggers } from "../lib/workflow-db.ts";

test("every bundled workflow recipe has a valid graph", () => {
  for (const template of workflowTemplates) {
    const imported = parseWorkflowImport(JSON.stringify(template));
    assert.equal(imported.nodes.length, template.nodes.length);
    assert.equal(imported.connections.length, template.connections.length);
    assert.equal(imported.active, false);
  }
});

test("workflow import rejects duplicate nodes and unsafe connections", () => {
  assert.throws(() => parseWorkflowImport(JSON.stringify({ nodes: [{ id: "a", kind: "trigger", config: {}, x: 0, y: 0 }, { id: "a", kind: "crm", config: {}, x: 1, y: 1 }], connections: [] })), /duplicate node/);
  assert.throws(() => parseWorkflowImport(JSON.stringify({ nodes: [{ id: "a", kind: "trigger", config: {}, x: 0, y: 0 }], connections: [{ id: "c", from: "a", to: "missing" }] })), /invalid connection/);
});

test("workflow import rejects unsupported node kinds and oversized files", () => {
  assert.throws(() => parseWorkflowImport(JSON.stringify({ nodes: [{ id: "a", kind: "shell", config: {}, x: 0, y: 0 }], connections: [] })), /invalid or duplicate node/);
  assert.throws(() => parseWorkflowImport(" ".repeat(1_048_577)), /1 MB/);
});

test("payment and attendance recipe nodes are recognized as live event triggers", () => {
  const payment = workflowTemplates.find((item) => item.id === "payment-recovery")!;
  const attendance = workflowTemplates.find((item) => item.id === "attendance-recovery")!;
  assert.equal(workflowMatchesTriggers(payment.nodes, ["Payment failed"]), true);
  assert.equal(workflowMatchesTriggers(attendance.nodes, ["Attendance submitted"]), true);
});
