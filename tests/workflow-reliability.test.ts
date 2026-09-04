import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkflowReliabilityOverview } from "../lib/workflow-db.ts";

test("reliability overview calculates status rate and p95", () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ status: index < 18 ? "success" : "failed", duration_ms: (index + 1) * 10, steps: [] }));
  const overview = buildWorkflowReliabilityOverview(rows);
  assert.equal(overview.successRate, 90);
  assert.equal(overview.failed, 2);
  assert.equal(overview.p95DurationMs, 190);
});

test("slow nodes are ranked by average duration", () => {
  const overview = buildWorkflowReliabilityOverview([{ status: "success", duration_ms: 100, steps: [
    { nodeId: "a", title: "Fast node", status: "success", durationMs: 10, detail: "" },
    { nodeId: "b", title: "Slow node", status: "success", durationMs: 80, detail: "" }
  ] }]);
  assert.equal(overview.slowNodes[0].title, "Slow node");
  assert.equal(overview.slowNodes[0].averageMs, 80);
});

test("empty execution history is healthy by default", () => {
  const overview = buildWorkflowReliabilityOverview([]);
  assert.equal(overview.successRate, 100);
  assert.equal(overview.p95DurationMs, 0);
});
