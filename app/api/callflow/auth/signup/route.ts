import { NextRequest, NextResponse } from "next/server";
import { createPersonalWorkspace } from "@/lib/callflow-signup";
import { usesSupabaseAuth, supabaseSignup } from "@/lib/supabase-auth";
import { validateSignup } from "@/lib/callflow-signup-input";
import { requirePlatformPool } from "@/lib/platform/database";

export async function POST(request: NextRequest) {
  const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) return reply({ error: "Request too large." }, 413);
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "Request too large." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: "Invalid signup details." }, 400); }
    // Shared database limit works across server instances and does not trust spoofable IP headers.
    const limit = await requirePlatformPool().query<{ attempts: number }>(`INSERT INTO callflow_signup_limits (bucket, attempts)
      VALUES (date_trunc('hour', NOW()), 1) ON CONFLICT (bucket)
      DO UPDATE SET attempts = callflow_signup_limits.attempts + 1 RETURNING attempts`);
    if (limit.rows[0].attempts > 100) return reply({ error: "Signup is busy. Please try again later." }, 429);
    if (usesSupabaseAuth()) {
      const input = validateSignup(body);
      const result = await supabaseSignup(input);
      if (result.confirmationRequired) return reply({ created: false, confirmationRequired: true }, 202);
      await createPersonalWorkspace({ ...input, email: result.user.email }, result.user.id);
    } else {
      await createPersonalWorkspace(body);
    }
    return reply({ created: true }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "AUTH_RATE_LIMITED") return reply({ error: "Too many attempts. Please try again later." }, 429);
    if (message === "INVALID_CREDENTIALS") return reply({ error: "Could not create the account. Try signing in or use a stronger password." }, 400);
    if (message === "INVALID_SIGNUP") return reply({ error: "Enter a name, workspace name, valid email and password of 8–128 characters." }, 400);
    if (message === "ACCOUNT_EXISTS") return reply({ error: "Account could not be created. Try signing in or contact support." }, 409);
    return reply({ error: "Signup is temporarily unavailable. Please try again later." }, 503);
  }
}
