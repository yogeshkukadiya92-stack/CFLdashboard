import assert from "node:assert/strict";
import test from "node:test";
import { buildAttendanceRegistrationCsv } from "../lib/workflow-csv-export.ts";
import type { AttendanceEntry, RegistrationEntry } from "../lib/types.ts";

const attendance = [
  { id: "a1", sessionId: "s1", sessionSlug: "intro-one", workshopId: "source", workshopName: "Source", attendeeName: "Registered User", mobile: "98765 43210", submittedAt: "2026-09-06T08:00:00Z" },
  { id: "a2", sessionId: "s1", sessionSlug: "intro-one", workshopId: "source", workshopName: "Source", attendeeName: "New User", mobile: "9876500000", submittedAt: "2026-09-06T09:00:00Z" },
  { id: "a3", sessionId: "other", sessionSlug: "other", workshopId: "source", workshopName: "Source", attendeeName: "Ignored", mobile: "9000000000", submittedAt: "2026-09-06T10:00:00Z" }
] as AttendanceEntry[];
const registrations = [{ id: "r1", workshopId: "target", mobile: "9876543210" }] as RegistrationEntry[];

test("CSV export matches attendance mobiles only against the selected workshop", () => {
  const result = buildAttendanceRegistrationCsv({ attendanceEntries: attendance, registrations, sessionIds: ["s1"], workshopId: "target", include: "Registered and not registered", redactSensitive: false });
  assert.equal(result.rowCount, 2);
  assert.match(result.content, /Registered User/);
  assert.match(result.content, /"Registered"/);
  assert.match(result.content, /"Not registered"/);
  assert.doesNotMatch(result.content, /Ignored/);
});

test("CSV export can include only unregistered attendees", () => {
  const result = buildAttendanceRegistrationCsv({ attendanceEntries: attendance, registrations, sessionIds: ["s1"], workshopId: "target", include: "Not registered only" });
  assert.equal(result.rowCount, 1);
  assert.match(result.content, /New User/);
  assert.doesNotMatch(result.content, /Registered User/);
});
