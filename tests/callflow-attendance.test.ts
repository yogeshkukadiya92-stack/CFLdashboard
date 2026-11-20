import assert from "node:assert/strict";
import test from "node:test";
import { registerAttendanceLead, updateWorkshopAttendance, workshopAttendanceRows, assignAttendanceLead, ownsAttendanceLead, type AttendanceState } from "../lib/callflow-attendance.ts";
import type { Lead, AttendanceSession } from "../lib/types.ts";
const lead = { id: "lead", name: "Participant", mobile: "+91 9876543210", assignedSalesPersonId: "one", assignedTo: "One" } as Lead;
const session = { id: "session", workshopId: "workshop", workshopName: "Intro", workshopSlug: "intro", slug: "intro-one", title: "Introduction", introductionSessionId: "intro", batchId: "batch", published: true } as AttendanceSession;
function state(): AttendanceState { return { leads: [{ ...lead }], attendanceSessions: [session], attendanceEntries: [], registrations: [], salesPeople: [{ id: "one", name: "One" }, { id: "two", name: "Two" }, { id: "inactive", name: "Inactive", isActive: false }] }; }
const now = "2026-11-20T10:00:00Z";
test("registration is automatic from the lead and never fabricates attendance", () => {
 const s = state(); registerAttendanceLead(s, lead, session, now, "reg"); registerAttendanceLead(s, lead, session, now, "retry");
 assert.equal(s.registrations.length, 1); assert.equal(s.attendanceEntries.length, 0);
 assert.equal(workshopAttendanceRows(s, [lead])[0].status, "not_marked");
 assert.equal(s.registrations[0].assignedSalesPersonId, "one");
});
test("recorded intro attendance appears automatically even without a registration", () => {
 const s = state(); updateWorkshopAttendance(s, lead, session, "checked_in", "One", now, "a"); s.registrations = [];
 const rows = workshopAttendanceRows(s, [lead]); assert.equal(rows[0].status, "checked_in"); assert.equal(rows[0].registered, false);
 assert.equal(workshopAttendanceRows(s, [{ ...lead, mobile: "9000000000" }]).length, 0);
});
test("attendance changes save in shared records and absent keeps previous responses in history", () => {
 const s = state(); updateWorkshopAttendance(s, lead, session, "checked_in", "One", now, "a"); updateWorkshopAttendance(s, lead, session, "late", "One", now, "b");
 assert.equal(s.attendanceEntries.length, 1); assert.equal(workshopAttendanceRows(s, [lead])[0].status, "late");
 updateWorkshopAttendance(s, lead, session, "absent", "One", now, "c");
 assert.equal(s.attendanceEntries.length, 0); assert.equal(workshopAttendanceRows(s, [lead])[0].status, "absent");
 assert.equal(s.registrations[0].attendanceHistory?.[0].previousEntries[0].status, "late");
});
test("assignment moves both CRM lead and registration to an active salesperson", () => {
 const s = state(); registerAttendanceLead(s, lead, session, now, "r"); assignAttendanceLead(s, lead, "two", "One", now, "assignment");
 assert.equal(s.leads[0].assignedTo, "Two"); assert.equal(s.registrations[0].assignedSalesPersonId, "two");
 assert.equal(ownsAttendanceLead(s.leads[0], "one", "One"), false); assert.equal(ownsAttendanceLead(s.leads[0], "two", "Two"), true);
 assert.throws(() => assignAttendanceLead(s, lead, "inactive", "One", now, "bad"));
});
test("workshop and batch boundaries prevent false matches", () => {
 const s = state(); registerAttendanceLead(s, lead, session, now, "r");
 s.attendanceSessions = [{ ...session, id: "other", workshopId: "other" }, { ...session, id: "batch-two", batchId: "two" }];
 assert.equal(workshopAttendanceRows(s, [lead]).length, 0);
});
test("stable salesperson ID takes precedence over duplicate names", () => {
 assert.equal(ownsAttendanceLead(lead, "wrong", "One"), false);
 assert.equal(ownsAttendanceLead({ ...lead, assignedSalesPersonId: undefined }, "one", "One"), true);
});
