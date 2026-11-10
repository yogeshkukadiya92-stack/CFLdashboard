import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./owner-crypto.ts";
import { requirePlatformPool } from "./platform/database.ts";
import { getAppState } from "./db.ts";
import { validateSignup } from "./callflow-signup-input.ts";

export async function createPersonalWorkspace(value: unknown, supabaseUserId?: string) {
  const input = validateSignup(value);
  const legacyTable = await requirePlatformPool().query("SELECT to_regclass('public.app_state') AS name");
  if (legacyTable.rows[0]?.name) {
    const legacy = await getAppState();
    if (!legacy) throw new Error("SIGNUP_UNAVAILABLE");
    if (legacy.salesTeamUsers.some((value: unknown) => {
      const user = value as { email?: string };
      return user.email?.trim().toLowerCase() === input.email;
    })) throw new Error("ACCOUNT_EXISTS");
  }
  const passwordHash = supabaseUserId ? null : hashPassword(input.password);
  const client = await requirePlatformPool().connect();
  try {
    await client.query("BEGIN");
    if (supabaseUserId) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [supabaseUserId]);
      const existing = await client.query("SELECT id FROM callflow_users WHERE supabase_user_id = $1", [supabaseUserId]);
      if (existing.rowCount) { await client.query("COMMIT"); return; }
    }
    const tenantId = randomUUID();
    // The server chooses the tenant and role. Public input never grants access to an existing company.
    await client.query("SELECT set_config('callflow.tenant_id', $1, true)", [tenantId]);
    const user = await client.query<{ id: string }>(`INSERT INTO callflow_users
      (display_name, email_normalized, password_hash, supabase_user_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.name, input.email, passwordHash, supabaseUserId || null]);
    await client.query(`INSERT INTO callflow_companies (id, name, slug) VALUES ($1, $2, $3)`,
      [tenantId, input.workspaceName, `personal-${tenantId}`]);
    await client.query(`INSERT INTO callflow_memberships (tenant_id, user_id, role)
      VALUES ($1, $2, 'salesperson')`, [tenantId, user.rows[0].id]);
    // Personal signup does not purchase seats or create a paid subscription.
    await client.query(`INSERT INTO callflow_company_settings (tenant_id, billing_note)
      VALUES ($1, 'Self-service personal workspace')`, [tenantId]);
    await client.query(`INSERT INTO callflow_billing_profiles (tenant_id, billing_mode, status, billed_seats, price_per_seat_paise)
      VALUES ($1, 'manual', 'manual_active', 0, 0)`, [tenantId]);
    await client.query(`INSERT INTO callflow_lead_stages (tenant_id,code,name,sort_order) VALUES
      ($1,'new','New',10),($1,'contacted','Contacted',20),($1,'interested','Interested',30),
      ($1,'follow_up','Follow-up',40),($1,'won','Won',50),($1,'lost','Lost',60)`, [tenantId]);
    await client.query(`INSERT INTO callflow_dispositions (tenant_id,code,name,requires_note,requires_follow_up,target_stage,sort_order) VALUES
      ($1,'WARM','Warm',false,false,'interested',10),($1,'INVITE_INTRO','Invite intro',false,false,'contacted',20),
      ($1,'CALLBACK_REQUESTED','Callback requested',false,true,'follow_up',30),($1,'MEETING_BOOKED','Meeting booked',false,true,'interested',40),
      ($1,'PROPOSAL_SENT','Proposal sent',false,true,'interested',50),($1,'NOT_ELIGIBLE','Not eligible',true,false,'lost',60),
      ($1,'NO_ANSWER','No answer',false,false,NULL,70),($1,'WRONG_NUMBER','Wrong number',true,false,'lost',80),
      ($1,'CONVERTED','Converted',false,false,'won',90)`, [tenantId]);
    await client.query(`INSERT INTO callflow_audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
      VALUES ($1, $2, 'workspace.signup', 'company', $3)`, [tenantId, user.rows[0].id, tenantId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if ((error as { code?: string }).code === "23505") throw new Error("ACCOUNT_EXISTS");
    throw error;
  } finally { client.release(); }
}
