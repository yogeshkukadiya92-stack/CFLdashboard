import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("workshop messages use selected credentials and never fall back for missing senders", async () => {
  const cwd = process.cwd();
  const directory = await mkdtemp(path.join(tmpdir(), "cfl-wa-"));
  const previousDb = process.env.DATABASE_URL;
  const previousFetch = globalThis.fetch;
  delete process.env.DATABASE_URL;
  process.chdir(directory);
  try {
    const { saveWhatsAppAccount, resolveWhatsAppAccount } = await import("../lib/whatsapp-accounts.ts");
    const { sendRegistrationConfirmation } = await import("../lib/registration-confirmation.ts");
    for (const id of ["first", "second"]) await saveWhatsAppAccount({ id, label: id, number: id === "first" ? "919876543210" : "919876543211", apiUrl: `https://${id}.example/send`, authToken: `${id}-secret`, otpTemplate: "otp", language: "en" });
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    globalThis.fetch = (async (url, init) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return new Response('{"IsSuccess":true}', { status: 200 }); }) as typeof fetch;
    const registration = { id: "r1", fullName: "Participant", mobile: "9876543210", workshopTitle: "Workshop", registrationNumber: "REG-0001" } as Parameters<typeof sendRegistrationConfirmation>[0];
    const form = { whatsappConfirmationEnabled: true, whatsappConfirmationTemplate: "confirmed", manualWhatsappStartDate: "Tomorrow" };
    for (const id of ["first", "second"]) {
      assert.equal((await sendRegistrationConfirmation(registration, { ...form, whatsappSenderId: id, whatsappConfirmationButtonValues: ["https://example.com/join", "confirm"] })).sent, true);
      assert.equal(calls.at(-1)?.url, `https://${id}.example/send`);
      assert.deepEqual(calls.at(-1)?.body.buttonValue, ["https://example.com/join", "confirm"]);
      assert.equal(calls.at(-1)?.body.authToken, `${id}-secret`);
      assert.equal(calls.at(-1)?.body.from, id === "first" ? "919876543210" : "919876543211");
    }
    assert.equal((await sendRegistrationConfirmation(registration, { ...form, whatsappSenderId: "missing" })).sent, false);
    assert.equal((await sendRegistrationConfirmation(registration, { ...form, whatsappSenderId: "first", whatsappConfirmationButtonValues: [" "] })).sent, false);
    assert.equal(calls.length, 2);
    await assert.rejects(resolveWhatsAppAccount("missing"));
    assert.equal(await resolveWhatsAppAccount(), undefined);
  } finally {
    globalThis.fetch = previousFetch; process.chdir(cwd);
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    await rm(directory, { recursive: true, force: true });
  }
});
