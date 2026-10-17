import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { attendanceWindow } from "../lib/attendance-window.ts";

// Execute the real route with controlled storage and Next's after-response queue.
// No production records or external providers are touched by these tests.
function harness() {
  const session = {
    id: "session-test", slug: "test", published: true, fields: [],
    workshopId: "workshop-test", workshopName: "Test workshop",
    zoomJoinUrl: "https://zoom.us/j/123456789", responseLimit: 0
  };
  let entries: Array<Record<string, unknown>> = [];
  const pending: Array<() => Promise<void>> = [];
  const events: string[] = [];
  const db = {
    isDbEnabled: async () => true,
    getAttendanceFormState: async () => ({ attendanceSessions: [session], responseCounts: { [session.id]: entries.length } }),
    getAppState: async () => {
      events.push("workflows");
      return { attendanceSessions: [session], attendanceEntries: entries };
    },
    getDbPool: () => { events.push("promotion"); return null; },
    mutateAttendanceEntries: async (mutate: (rows: Array<Record<string, unknown>>) => { entries: Array<Record<string, unknown>>; result: unknown }) => {
      const next = mutate(entries);
      entries = next.entries;
      events.push("committed");
      return next.result;
    }
  };
  const modules: Record<string, unknown> = {
    "@/lib/db": db,
    "@/lib/attendance-window": { attendanceWindow },
    "@/lib/registration-confirmation": {},
    "@/lib/registration-jobs": {},
    "@/lib/mfw-registration": {},
    "@/lib/workflow-engine": {},
    "@/lib/workflow-waiting-confirmation": {},
    "@/lib/workshop-hierarchy": {},
    "@/lib/workflow-db": { listActiveWorkflowsForTrigger: async () => [] },
    "next/server": {
      NextResponse: { json: (body: unknown, options?: ResponseInit) => Response.json(body, options) },
      after: (callback: () => Promise<void>) => { events.push("scheduled"); pending.push(callback); }
    }
  };
  const source = readFileSync(new URL("../app/api/attendance-state/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const route = {} as { GET: (request: Request) => Promise<Response>; POST: (request: Request) => Promise<Response> };
  new Function("require", "exports", compiled)((name: string) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  }, route);
  const request = (patch: Record<string, unknown> = {}) => new Request("https://example.test/api/attendance-state", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry: { sessionId: session.id, sessionSlug: session.slug, attendeeName: "Test attendee", mobile: "9876543210", ...patch } })
  });
  return { route, db, events, pending, request, session };
}

test("attendance responds after commit without starting slow registration promotion", async () => {
  const h = harness();
  let promotionCalls = 0;
  h.db.getDbPool = () => { promotionCalls += 1; return null; };
  const response = await h.route.POST(h.request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.entry.attendeeName, "Test attendee");
  assert.equal(body.responseCount, 1);
  assert.equal(body.joinUrl, h.session.zoomJoinUrl);
  assert.equal(promotionCalls, 0, "Promotion must not run before the response");
  assert.deepEqual(h.events, ["committed", "scheduled"]);
  assert.equal(h.pending.length, 1);
});

test("after-response processing preserves promotion before workflow execution", async () => {
  const h = harness();
  await h.route.POST(h.request());
  await h.pending[0]();
  assert.deepEqual(h.events, ["committed", "scheduled", "promotion", "workflows"]);
});

test("failed attendance storage never confirms success or schedules follow-ups", async () => {
  const h = harness();
  h.db.mutateAttendanceEntries = async () => { throw new Error("Storage unavailable"); };
  const response = await h.route.POST(h.request());
  assert.equal(response.status, 500);
  assert.equal(h.pending.length, 0);
});

test("duplicate attendance still returns 409 and schedules no extra follow-ups", async () => {
  const h = harness();
  await h.route.POST(h.request());
  const response = await h.route.POST(h.request());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).duplicate, true);
  assert.equal(h.pending.length, 1);
});

test("public session returns the response count without exposing the Zoom link", async () => {
  const h = harness();
  await h.route.POST(h.request());
  const response = await h.route.GET(new Request("https://example.test/api/attendance-state?slug=test"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.responseCount, 1);
  assert.equal(body.attendanceSession.zoomJoinUrl, undefined);
});

test("response limits and invalid mobile numbers remain enforced", async () => {
  const h = harness();
  assert.equal((await h.route.POST(h.request({ mobile: "123" }))).status, 400);
  h.session.responseLimit = 1;
  assert.equal((await h.route.POST(h.request())).status, 200);
  assert.equal((await h.route.POST(h.request({ mobile: "9876543211" }))).status, 403);
});

test("promotion delegates provider calls to the durable worker outside the row lock", () => {
  const source = readFileSync(new URL("../app/api/attendance-state/route.ts", import.meta.url), "utf8");
  const promotion = source.slice(source.indexOf("async function promoteAttendanceWaitingRegistrations"), source.indexOf("async function runAttendanceWorkflows"));
  assert.doesNotMatch(promotion, /await syncConfirmedRegistrationToMfw/);
  assert.match(promotion, /INSERT INTO cfl_registration_jobs/);
});
