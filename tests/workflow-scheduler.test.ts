import assert from "node:assert/strict";
import test from "node:test";
import { nextScheduleAt, scheduleDefinition, scheduleIsDue } from "../lib/workflow-scheduler.ts";
import type { WorkflowNode } from "../lib/workflow-studio.ts";

function schedule(config: Record<string, unknown>, title = "Scheduled time"): WorkflowNode {
  return { id: "schedule", kind: "delay", title, subtitle: "", x: 0, y: 0, config };
}

test("daily schedules run at the configured India time", () => {
  const node = schedule({ frequency: "daily", time: "09:00", timezone: "Asia/Kolkata" });
  assert.equal(scheduleIsDue(node, new Date("2026-09-04T03:30:00.000Z")), true);
  assert.equal(scheduleIsDue(node, new Date("2026-09-04T03:31:00.000Z")), false);
  assert.equal(nextScheduleAt(node, new Date("2026-09-04T03:30:01.000Z")), "2026-09-05T03:30:00.000Z");
});

test("weekly schedules respect the selected weekday", () => {
  const node = schedule({ frequency: "weekly", time: "09:00", timezone: "Asia/Kolkata", weekdays: ["Fri"] });
  assert.equal(scheduleIsDue(node, new Date("2026-09-04T03:30:00.000Z")), true);
  assert.equal(scheduleIsDue(node, new Date("2026-09-05T03:30:00.000Z")), false);
});

test("one-time schedules match one UTC minute and expire afterwards", () => {
  const node = schedule({ frequency: "once", scheduledAt: "2026-09-04T10:00:00.000Z", timezone: "UTC" }, "Schedule for date");
  assert.equal(scheduleIsDue(node, new Date("2026-09-04T10:00:45.000Z")), true);
  assert.equal(nextScheduleAt(node, new Date("2026-09-04T10:01:00.000Z")), null);
});

test("unsupported timezones fall back to Asia Kolkata", () => {
  assert.equal(scheduleDefinition(schedule({ frequency: "daily", timezone: "Unsafe/Zone" }))?.timezone, "Asia/Kolkata");
});

test("renaming a configured schedule node does not disable it", () => {
  const node = schedule({ scheduleEnabled: true, frequency: "daily", time: "09:00", timezone: "Asia/Kolkata" }, "Morning operations");
  assert.equal(scheduleIsDue(node, new Date("2026-09-04T03:30:00.000Z")), true);
});
