import assert from "node:assert/strict";
import test from "node:test";
import { executeWorkflow } from "../lib/workflow-engine.ts";
import type { Connection, WorkflowNode } from "../lib/workflow-studio.ts";

test("workflow engine evaluates the assignment node and returns node-level logs", () => {
  const nodes: WorkflowNode[] = [
    { id: "trigger", kind: "trigger", title: "Registration received", subtitle: "", x: 0, y: 0, config: { event: "New public registration" } },
    { id: "assign", kind: "crm", title: "Assign sales person", subtitle: "", x: 200, y: 0, config: { assignmentRules: [{ id: "city-rule", city: "Ahmedabad", salesPersonId: "sales-1" }], fallbackStrategy: "least-active" } },
    { id: "message", kind: "message", title: "Send WhatsApp template", subtitle: "", x: 400, y: 0, config: { template: "registration_confirmed" } }
  ];
  const connections: Connection[] = [
    { id: "one", from: "trigger", to: "assign" },
    { id: "two", from: "assign", to: "message" }
  ];
  const result = executeWorkflow({
    nodes,
    connections,
    registration: { id: "reg-100", fullName: "Riya Shah", city: "Ahmedabad", source: "Registration Link", createdAt: "2026-09-04T10:00:00Z" },
    salesPeople: [{ id: "sales-1", name: "Bhavin", isActive: true, acceptingLeads: true }],
    leads: []
  });
  assert.equal(result.status, "success");
  assert.equal(result.assignment?.salesPersonId, "sales-1");
  assert.equal(result.steps.length, 3);
  assert.match(result.steps[1].detail, /Bhavin selected/);
  assert.match(result.steps[2].detail, /delivery suppressed/);
});

test("workflow engine exposes attendance event context to attendance nodes", () => {
  const result = executeWorkflow({
    nodes: [{ id: "attendance", kind: "attendance", title: "Check attendance", subtitle: "", x: 0, y: 0, config: { match: "Mobile number" } }],
    connections: [],
    registration: { id: "att-1", attendanceStatus: "late", attendanceSessionId: "session-1", promotedRegistrations: 2 },
    salesPeople: [],
    leads: [],
    mode: "production"
  });
  assert.equal(result.steps[0].status, "success");
  assert.deepEqual(result.steps[0].output, { attendanceStatus: "late", sessionId: "session-1", promotedRegistrations: 2 });
});

test("workflow engine exposes payment context without performing external side effects", () => {
  const result = executeWorkflow({
    nodes: [{ id: "payment", kind: "payment", title: "Update payment status", subtitle: "", x: 0, y: 0, config: { action: "Update registration payment" } }],
    connections: [],
    registration: { id: "reg-1", paymentId: "pay-1", paymentStatus: "captured", amountPaid: 2500 },
    salesPeople: [], leads: [], mode: "test"
  });
  assert.deepEqual(result.steps[0].output, { paymentStatus: "captured", amount: 2500, paymentId: "pay-1", registrationId: undefined });
});
