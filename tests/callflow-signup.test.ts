import assert from "node:assert/strict";
import test from "node:test";
import { validateSignup } from "../lib/callflow-signup-input.ts";
const valid = { name: "Test User", workspaceName: "Test Work", email: "TEST@example.com ", password: "test-password" };
test("signup validates required fields and ignores tenant/role injection", () => {
  assert.deepEqual(validateSignup({ ...valid, tenantId: "existing-company", role: "company_manager" }), { ...valid, email: "test@example.com" });
  for (const input of [null, [], { ...valid, email: "bad" }, { ...valid, password: "short" }, { ...valid, name: " " }, { ...valid, workspaceName: " " }, { ...valid, password: " ".repeat(8) }, { ...valid, password: "x".repeat(129) }]) {
    assert.throws(() => validateSignup(input), /INVALID_SIGNUP/);
  }
});

test("real database: isolated signup, rollback on duplicates, login and session rotation", { skip: !process.env.CALLFLOW_SIGNUP_TEST_DB }, async () => {
  // Set only to an isolated migrated test database. Never run this against production.
  process.env.DATABASE_URL = process.env.CALLFLOW_SIGNUP_TEST_DB;
  const { createPersonalWorkspace } = await import("../lib/callflow-signup.ts");
  const { loginCentralAccount, centralSessionIsActive } = await import("../lib/callflow-central-session.ts");
  const { readCallFlowToken } = await import("../lib/callflow-auth.ts");
  const { requirePlatformPool, withTenantTransaction } = await import("../lib/platform/database.ts");
  const pool = requirePlatformPool();
  const suffix = crypto.randomUUID();
  const first = { ...valid, email: `a-${suffix}@example.com` };
  const second = { ...valid, email: `b-${suffix}@example.com` };
  try {
    await createPersonalWorkspace(first); await createPersonalWorkspace(second);
    const before = await pool.query("SELECT count(*) FROM callflow_companies");
    await assert.rejects(createPersonalWorkspace(first), /ACCOUNT_EXISTS/);
    assert.equal((await pool.query("SELECT count(*) FROM callflow_companies")).rows[0].count, before.rows[0].count);
    await assert.rejects(loginCentralAccount(first.email, "incorrect", { installId: "one" }), /INVALID_CREDENTIALS/);
    const one = await loginCentralAccount(first.email, first.password, { installId: "one" });
    const two = await loginCentralAccount(second.email, second.password, { installId: "two" });
    assert.ok(one && two);
    const a = readCallFlowToken(one.accessToken, "access")!;
    const b = readCallFlowToken(two.accessToken, "access")!;
    assert.notEqual(a.tenantId, b.tenantId);
    assert.notEqual(a.userId, b.userId);
    const own = await withTenantTransaction(a.tenantId!, client => client.query("SELECT user_id FROM callflow_memberships"));
    assert.deepEqual(own.rows.map(row => row.user_id), [a.userId]);
    const others = await withTenantTransaction(a.tenantId!, client => client.query("SELECT id FROM callflow_memberships WHERE tenant_id = $1", [b.tenantId]));
    assert.equal(others.rowCount, 0);
    const workspaceData = await withTenantTransaction(a.tenantId!, async client => {
      await client.query("INSERT INTO callflow_leads (tenant_id,name) VALUES ($1,'Private lead')", [a.tenantId]);
      return { stages: (await client.query("SELECT id FROM callflow_lead_stages")).rowCount, dispositions: (await client.query("SELECT id FROM callflow_dispositions")).rowCount };
    });
    assert.equal(workspaceData.stages, 6);
    assert.equal(workspaceData.dispositions, 9);
    const foreignLeads = await withTenantTransaction(b.tenantId!, client => client.query("SELECT id FROM callflow_leads WHERE tenant_id=$1", [a.tenantId]));
    assert.equal(foreignLeads.rowCount, 0);
    const concurrent = { ...valid, email: `race-${suffix}@example.com` };
    const race = await Promise.allSettled([createPersonalWorkspace(concurrent), createPersonalWorkspace(concurrent)]);
    assert.equal(race.filter(result => result.status === "fulfilled").length, 1);
    const externalId = crypto.randomUUID();
    const external = { ...valid, email: `supabase-${suffix}@example.com` };
    await createPersonalWorkspace(external, externalId);
    await createPersonalWorkspace(external, externalId);
    await assert.rejects(loginCentralAccount(external.email, external.password, { installId: "external" }), /INVALID_CREDENTIALS/);
    await assert.rejects(loginCentralAccount(external.email, external.password, { installId: "external" }, crypto.randomUUID()), /INVALID_CREDENTIALS/);
    assert.ok(await loginCentralAccount(external.email, external.password, { installId: "external" }, externalId));
    const externalRow = await pool.query("SELECT password_hash FROM callflow_users WHERE supabase_user_id=$1", [externalId]);
    assert.equal(externalRow.rowCount, 1);
    assert.equal(externalRow.rows[0].password_hash, null);
    const secret = await pool.query("SELECT password_hash FROM callflow_users WHERE id=$1", [a.userId]);
    assert.notEqual(secret.rows[0].password_hash, first.password);
    await loginCentralAccount(first.email, first.password, { installId: "replacement" });
    assert.equal(await centralSessionIsActive(a), false);
    assert.equal(await centralSessionIsActive(b), true);
  } finally { await pool.end(); }
});
