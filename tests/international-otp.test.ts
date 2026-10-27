import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { internationalPhone } from "../lib/phone-number.ts";

function route(file: string, modules: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported = {} as { POST: (request: Request) => Promise<Response> };
  new Function("require", "exports", compiled)((name: string) => {
    assert.ok(name in modules, `Unexpected module ${name}`);
    return modules[name];
  }, exported);
  return exported;
}

test("OTP send and verify use the same full number; provider gets the correct country code", async () => {
  const saved: string[] = [];
  const verified: string[] = [];
  const recipients: string[] = [];
  const modules = {
    "@/lib/phone-number": { internationalPhone },
    "@/lib/db": { getAppState: async () => ({ forms: [{ id: "test-form" }] }) },
    "@/lib/otp-store": { saveOtp: async (mobile: string) => { saved.push(mobile); }, clearOtp: async () => {}, verifyStoredOtp: async (mobile: string) => { verified.push(mobile); return "ok"; } },
    "@/lib/whatsapp-accounts": { resolveWhatsAppAccount: async () => ({ apiUrl: "https://example.test/otp", authToken: "test", otpTemplate: "otp", number: "919999999999", language: "en" }) },
    "@/lib/auth": { verifyAuthToken: async () => false },
    "@/lib/otp-override": { canUseManualOtpOverride: () => false },
    "@/lib/workshop-otp-fallback": { verifyWorkshopOtpFallbackHash: () => false },
    "node:crypto": { randomInt: () => 123456 },
    "next/server": { NextResponse: { json: (body: unknown, options?: ResponseInit) => Response.json(body, options) } }
  };
  const send = route("../app/api/otp/send/route.ts", modules);
  const verify = route("../app/api/otp/verify/route.ts", modules);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { recipients.push(JSON.parse(String(init?.body)).PhoneNumber); return Response.json({ IsSuccess: true }); };
  try {
    for (const mobile of ["+971501234567", "+6581234567", "9876543210"]) {
      const request = () => Object.assign(new Request("https://example.test/otp", { method: "POST", body: JSON.stringify({ mobile, formId: "test-form", otp: "123456" }) }), { cookies: { get: () => undefined } });
      assert.equal((await send.POST(request())).status, 200);
      assert.equal((await verify.POST(request())).status, 200);
    }
    assert.deepEqual(saved, ["+971501234567", "+6581234567", "+919876543210"]);
    assert.deepEqual(verified, saved);
    assert.deepEqual(recipients, ["971501234567", "6581234567", "919876543210"]);
    const invalid = new Request("https://example.test/otp", { method: "POST", body: JSON.stringify({ mobile: "+97112", formId: "test-form" }) });
    assert.equal((await send.POST(invalid)).status, 400);
    assert.equal(recipients.length, 3);
  } finally { globalThis.fetch = originalFetch; }
});
