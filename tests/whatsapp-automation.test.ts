import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { parseWhatsAppWebhook, verifyWhatsAppWebhookSignature } from "../lib/whatsapp-automation.ts";

test("WhatsApp webhook signature requires an exact SHA-256 HMAC", () => {
  const previous = process.env.WHATSAPP_WEBHOOK_APP_SECRET;
  process.env.WHATSAPP_WEBHOOK_APP_SECRET = "test-app-secret";
  const body = JSON.stringify({ object: "whatsapp_business_account" });
  const signature = createHmac("sha256", "test-app-secret").update(body).digest("hex");
  assert.equal(verifyWhatsAppWebhookSignature(body, `sha256=${signature}`), true);
  assert.equal(verifyWhatsAppWebhookSignature(`${body}x`, `sha256=${signature}`), false);
  assert.equal(verifyWhatsAppWebhookSignature(body, "sha256=not-hex"), false);
  if (previous === undefined) delete process.env.WHATSAPP_WEBHOOK_APP_SECRET;
  else process.env.WHATSAPP_WEBHOOK_APP_SECRET = previous;
});

test("Meta payload parser extracts incoming replies and delivery statuses", () => {
  const events = parseWhatsAppWebhook({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: {
      messages: [{ id: "wamid.inbound", from: "919876543210", timestamp: "1788500000", type: "text", text: { body: "CONFIRM" } }],
      statuses: [{ id: "wamid.outbound", recipient_id: "919876543210", timestamp: "1788500001", status: "delivered" }]
    } }] }]
  });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.type), ["message.received", "message.delivered"]);
  assert.equal(events[0].text, "CONFIRM");
  assert.equal(events[0].mobile, "919876543210");
  assert.equal(events[1].providerMessageId, "wamid.outbound");
});

test("unsupported or malformed webhook payloads are ignored safely", () => {
  assert.deepEqual(parseWhatsAppWebhook(null), []);
  assert.deepEqual(parseWhatsAppWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: "x", status: "unknown" }] } }] }] }), []);
});
