import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCallFlowToken, readCallFlowToken } from "../lib/callflow-auth.ts";

test("central mobile session migration enforces one active phone and refresh rotation", () => {
  const sql = readFileSync(new URL("../database/migrations/003_app_sessions.sql", import.meta.url), "utf8");
  assert.match(sql, /UNIQUE INDEX[\s\S]+user_id[\s\S]+revoked_at IS NULL/i);
  assert.match(sql, /refresh_token_hash/i);
  assert.match(sql, /offline_valid_until/i);
});

test("central access token carries tenant, session and device binding", () => {
  const token = createCallFlowToken({ userId: "u1", salesPersonId: "u1", name: "Sales", tenantId: "t1", sessionId: "s1", deviceId: "d1" }, "access", 60);
  assert.deepEqual(readCallFlowToken(token, "access"), { userId: "u1", salesPersonId: "u1", name: "Sales", tenantId: "t1", sessionId: "s1", deviceId: "d1" });
  assert.equal(readCallFlowToken(token, "refresh"), null);
});

test("central login implementation revokes prior session before inserting replacement", () => {
  const source = readFileSync(new URL("../lib/callflow-central-session.ts", import.meta.url), "utf8");
  const revokeAt = source.indexOf("signed_in_on_another_phone");
  const insertAt = source.indexOf("INSERT INTO callflow_user_sessions");
  assert.ok(revokeAt > 0 && insertAt > revokeAt);
  assert.match(source, /FOR UPDATE OF users/);
  assert.match(source, /randomBytes\(32\)/);
});
