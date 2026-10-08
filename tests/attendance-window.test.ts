import assert from "node:assert/strict";
import test from "node:test";
import { attendanceWindow } from "../lib/attendance-window.ts";
import type { AttendanceSession } from "../lib/types.ts";

function session(patch: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    createdAt: "2026-08-26T00:00:00.000Z",
    description: "Test session",
    fields: [],
    id: "session-1",
    published: true,
    sessionDate: "2026-08-27",
    slug: "test-session",
    startTime: "20:30",
    endTime: "22:30",
    title: "Test session",
    updatedAt: "2026-08-26T00:00:00.000Z",
    workshopId: "workshop-1",
    workshopName: "Workshop",
    workshopSlug: "workshop",
    ...patch
  };
}

test("attendance can open one day before the session", () => {
  const configured = session({ openDaysBefore: 1, openMinutesBefore: 0 });
  assert.equal(attendanceWindow(configured, new Date("2026-08-26T15:00:00.000Z").getTime()).allowed, true);
  assert.equal(attendanceWindow(configured, new Date("2026-08-26T14:59:59.000Z").getTime()).allowed, false);
});

test("existing sessions keep the 60 minute default", () => {
  const configured = session({ openDaysBefore: undefined, openMinutesBefore: undefined });
  assert.equal(attendanceWindow(configured, new Date("2026-08-27T14:00:00.000Z").getTime()).allowed, true);
  assert.equal(attendanceWindow(configured, new Date("2026-08-27T13:59:59.000Z").getTime()).allowed, false);
});

test("day and minute offsets are combined", () => {
  const configured = session({ openDaysBefore: 1, openMinutesBefore: 60 });
  assert.equal(attendanceWindow(configured, new Date("2026-08-26T14:00:00.000Z").getTime()).allowed, true);
});

test("overnight attendance stays open through the next day's closing grace period", () => {
  const configured = session({ sessionDate: "2026-10-08", startTime: "19:30", endTime: "00:40", openDaysBefore: 2, closeMinutesAfter: 120 });
  for (const time of ["2026-10-08T16:30:00+05:30", "2026-10-08T19:30:00+05:30", "2026-10-09T00:40:00+05:30", "2026-10-09T02:40:00+05:30"]) {
    assert.equal(attendanceWindow(configured, Date.parse(time)).allowed, true, time);
  }
  assert.equal(attendanceWindow(configured, Date.parse("2026-10-09T02:40:00.001+05:30")).allowed, false);
  assert.equal(attendanceWindow(configured, Date.parse("2026-10-06T18:29:59+05:30")).allowed, false);
});

test("same-day sessions still close after their configured grace period", () => {
  const configured = session({ closeMinutesAfter: 30 });
  assert.equal(attendanceWindow(configured, Date.parse("2026-08-27T23:00:00+05:30")).allowed, true);
  assert.equal(attendanceWindow(configured, Date.parse("2026-08-27T23:00:01+05:30")).allowed, false);
});
