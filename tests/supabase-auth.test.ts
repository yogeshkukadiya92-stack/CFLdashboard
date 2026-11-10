import assert from "node:assert/strict";
import test from "node:test";
import { supabaseSignup, supabasePasswordLogin } from "../lib/supabase-auth.ts";

test("Supabase adapter requires an authenticated session, handles confirmation and sanitizes failures", async () => {
  const originalFetch = globalThis.fetch;
  process.env.CALLFLOW_SUPABASE_URL = "https://auth.example.test";
  process.env.CALLFLOW_SUPABASE_ANON_KEY = "public-test-key";
  const input = { name: "Test", workspaceName: "My Work", email: "test@example.com", password: "password123" };
  const user = { id: "12345678-1234-4234-8234-123456789012", email: input.email };
  try {
    globalThis.fetch = async () => Response.json({ user });
    assert.deepEqual(await supabaseSignup(input), { confirmationRequired: true });
    await assert.rejects(supabasePasswordLogin(input.email, input.password), /INVALID_CREDENTIALS/);
    globalThis.fetch = async (url, options) => {
      assert.ok(String(url).startsWith("https://auth.example.test/auth/v1/"));
      assert.equal((options?.headers as Record<string,string>).apikey, "public-test-key");
      return Response.json({ user, access_token: "test-session" });
    };
    assert.deepEqual(await supabasePasswordLogin(input.email,input.password), user);
    assert.equal((await supabaseSignup(input)).confirmationRequired, false);
    globalThis.fetch = async () => Response.json({ code: "email_not_confirmed" }, { status: 400 });
    await assert.rejects(supabasePasswordLogin(input.email,input.password), /EMAIL_NOT_CONFIRMED/);
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    await assert.rejects(supabaseSignup(input), /AUTH_RATE_LIMITED/);
    globalThis.fetch = async () => { throw new Error("secret upstream diagnostics"); };
    await assert.rejects(supabaseSignup(input), /^Error: AUTH_UNAVAILABLE$/);
  } finally { globalThis.fetch = originalFetch; delete process.env.CALLFLOW_SUPABASE_URL; delete process.env.CALLFLOW_SUPABASE_ANON_KEY; }
});
