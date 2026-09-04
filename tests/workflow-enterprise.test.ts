import test from "node:test";
import assert from "node:assert/strict";
import { applyTransform, decryptCredential, encryptCredential, generateWorkflowFromPrompt, maskCredential, normalizeEnterpriseSettings } from "../lib/workflow-enterprise.ts";

test("credential vault encrypts values and only exposes a masked suffix", () => {
  const secret = "whatsapp-secret-1234";
  const encrypted = encryptCredential(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptCredential(encrypted), secret);
  assert.equal(maskCredential(secret), "••••1234");
});

test("AI builder creates a valid connected business workflow", () => {
  const generated = generateWorkflowFromPrompt("Assign workshop leads by city and send WhatsApp message");
  assert.ok(generated.nodes.some((node) => node.kind === "condition"));
  assert.ok(generated.nodes.some((node) => node.kind === "crm"));
  assert.ok(generated.nodes.some((node) => node.kind === "message"));
  assert.equal(generated.connections.length, generated.nodes.length - 1);
});

test("transformation nodes map values without mutating the source", () => {
  const source = { fullName: "  yogesh shah  " };
  const output = applyTransform(source, { sourceField: "fullName", targetField: "displayName", operation: "uppercase" });
  assert.equal(output.displayName, "  YOGESH SHAH  ");
  assert.equal(source.fullName, "  yogesh shah  ");
});

test("enterprise settings enforce collection bounds", () => {
  const normalized = normalizeEnterpriseSettings({ tags: Array.from({ length: 30 }, (_, index) => `tag-${index}`), comments: Array.from({ length: 150 }, (_, index) => ({ id: String(index) })) });
  assert.equal(normalized.tags.length, 20);
  assert.equal(normalized.comments.length, 100);
});
