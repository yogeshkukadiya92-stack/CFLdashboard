import assert from "node:assert/strict";
import test from "node:test";
import { sendRegistrationStatusNotifications } from "../lib/registration-confirmation.ts";
import type { BuilderForm, RegistrationEntry } from "../lib/types.ts";

const form = {
  whatsappConfirmationEnabled: true,
  whatsappConfirmationTemplate: "participant_confirmed",
  whatsappWaitingTemplate: "participant_waiting",
  whatsappReferrerWaitingTemplate: "referrer_waiting"
} satisfies Partial<BuilderForm>;

const baseRegistration: RegistrationEntry = {
  amountDue: 0,
  amountPaid: 0,
  batch: "Batch 2",
  city: "Surat",
  createdAt: "2026-08-29T00:00:00.000Z",
  email: "participant@example.com",
  fullName: "Test Participant",
  id: "reg-test",
  mobile: "+91 9876543210",
  paymentMode: "Full",
  status: "Paid",
  workshopId: "workshop-1",
  workshopSlug: "workshop-1",
  workshopTitle: "Healthy Forever"
};

test("routes confirmed and waiting WhatsApp messages only to allowed recipients", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiUrl = process.env.WHATSAPP_CONFIRMATION_API_URL;
  const previousToken = process.env.WHATSAPP_CONFIRMATION_AUTH_TOKEN;
  process.env.WHATSAPP_CONFIRMATION_API_URL = "https://whatsapp.example/send";
  process.env.WHATSAPP_CONFIRMATION_AUTH_TOKEN = "test-token";
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return new Response(JSON.stringify({ IsSuccess: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const confirmedPatch = await sendRegistrationStatusNotifications({
      ...baseRegistration,
      referralCode: "9123456789",
      referralCodeId: "reference-1",
      registrationNumber: "REG-0001",
      registrationStatus: "confirmed"
    }, form);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].PhoneNumber, "919876543210");
    assert.equal(requests[0].TemplateName, "participant_confirmed");
    assert.equal(confirmedPatch.confirmationWhatsappStatus, "sent");
    assert.equal(confirmedPatch.referrerWaitingWhatsappSentAt, undefined);

    requests.length = 0;
    const waitingPatch = await sendRegistrationStatusNotifications({
      ...baseRegistration,
      registrationStatus: "waiting",
      waitingPosition: 4,
      waitingReason: "capacity"
    }, form);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].PhoneNumber, "919876543210");
    assert.equal(requests[0].TemplateName, "participant_waiting");
    assert.equal(waitingPatch.waitingWhatsappStatus, "sent");
    assert.equal(waitingPatch.referrerWaitingWhatsappStatus, undefined);

    requests.length = 0;
    const referredWaitingPatch = await sendRegistrationStatusNotifications({
      ...baseRegistration,
      referralCode: "9123456789",
      referralCodeId: "reference-1",
      referrerName: "Test Referrer",
      registrationStatus: "waiting",
      waitingPosition: 5,
      waitingReason: "manual"
    }, form);
    assert.deepEqual(requests.map((request) => request.PhoneNumber), ["919876543210", "919123456789"]);
    assert.deepEqual(requests.map((request) => request.TemplateName), ["participant_waiting", "referrer_waiting"]);
    assert.deepEqual(requests[1].variables, ["Test Referrer", "Test Participant", "+91 9876543210", "Healthy Forever", "Batch 2", "WL-5"]);
    assert.equal(referredWaitingPatch.waitingWhatsappStatus, "sent");
    assert.equal(referredWaitingPatch.referrerWaitingWhatsappStatus, "sent");

    requests.length = 0;
    await sendRegistrationStatusNotifications({
      ...baseRegistration,
      referralCode: "9000000000",
      registrationStatus: "waiting",
      waitingPosition: 6,
      waitingReason: "invalid_referral"
    }, form);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].PhoneNumber, "919876543210");

    requests.length = 0;
    await sendRegistrationStatusNotifications({
      ...baseRegistration,
      referralCode: "9123456789",
      referralCodeId: "reference-1",
      referrerWaitingWhatsappSentAt: "2026-08-29T01:00:00.000Z",
      registrationStatus: "waiting",
      waitingPosition: 5,
      waitingWhatsappSentAt: "2026-08-29T01:00:00.000Z"
    }, form);
    assert.equal(requests.length, 0);

    globalThis.fetch = (async () => new Response("provider error", { status: 500 })) as typeof fetch;
    const failedPatch = await sendRegistrationStatusNotifications({
      ...baseRegistration,
      registrationStatus: "waiting",
      waitingPosition: 7,
      waitingReason: "capacity"
    }, form);
    assert.equal(failedPatch.waitingWhatsappStatus, "failed");
    assert.equal(failedPatch.waitingWhatsappSentAt, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiUrl === undefined) delete process.env.WHATSAPP_CONFIRMATION_API_URL;
    else process.env.WHATSAPP_CONFIRMATION_API_URL = previousApiUrl;
    if (previousToken === undefined) delete process.env.WHATSAPP_CONFIRMATION_AUTH_TOKEN;
    else process.env.WHATSAPP_CONFIRMATION_AUTH_TOKEN = previousToken;
  }
});
