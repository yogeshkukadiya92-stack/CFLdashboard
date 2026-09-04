import assert from "node:assert/strict";
import test from "node:test";
import { getAttendanceAutomationOverview } from "../lib/attendance-automation.ts";
import type { AttendanceEntry, AttendanceSession, RegistrationEntry } from "../lib/types.ts";

const session = {
  id: "session-1", workshopId: "workshop-1", workshopName: "Growth Workshop", workshopSlug: "growth", slug: "growth-attendance", title: "Day 1", description: "", sessionDate: "2026-09-05", startTime: "10:00", published: true, fields: [], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z"
} satisfies AttendanceSession;

const entry = {
  id: "attendance-1", sessionId: "session-1", sessionSlug: "growth-attendance", workshopId: "workshop-1", workshopName: "Growth Workshop", attendeeName: "Asha", mobile: "+91 9876543210", status: "late", submittedAt: "2026-09-04T05:00:00.000Z"
} satisfies AttendanceEntry;

function registration(id: string, mobile: string, source?: "attendance"): RegistrationEntry {
  return { id, workshopId: "workshop-1", workshopSlug: "growth", workshopTitle: "Growth Workshop", fullName: id, mobile, email: "", city: "", paymentMode: "Full", amountPaid: 0, amountDue: 0, status: "Paid", registrationStatus: "confirmed", confirmationSource: source, createdAt: "2026-09-04T04:00:00.000Z" };
}

test("attendance overview counts late arrivals, promotions and no-show risk", () => {
  const overview = getAttendanceAutomationOverview({
    entries: [entry],
    sessions: [session],
    registrations: [registration("attended", "9876543210", "attendance"), registration("missing", "9123456789")],
    now: new Date("2026-09-04T06:00:00.000Z").getTime()
  });
  assert.equal(overview.counts.late, 1);
  assert.equal(overview.counts.promoted, 1);
  assert.equal(overview.counts.noShowRisk, 1);
  assert.equal(overview.upcomingSessions, 1);
  assert.equal(overview.activity[0].sessionTitle, "Day 1");
});

test("waiting registrations are excluded from no-show risk", () => {
  const waiting = { ...registration("waiting", "9123456789"), registrationStatus: "waiting" as const };
  const overview = getAttendanceAutomationOverview({ entries: [], sessions: [], registrations: [waiting], now: new Date("2026-09-04T06:00:00.000Z").getTime() });
  assert.equal(overview.counts.noShowRisk, 0);
});
