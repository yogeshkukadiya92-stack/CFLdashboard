import assert from 'node:assert/strict';
import test from 'node:test';
import { manualWhatsAppUrl, renderManualWhatsApp } from '../lib/manual-whatsapp.ts';
import type { RegistrationEntry } from '../lib/types.ts';

const entry = { fullName: 'Yogesh', workshopTitle: 'Healthy Forever Batch 39', registrationNumber: 'REG-1234' } as RegistrationEntry;
test('personalizes the supplied Hindi message without leaving placeholders', () => {
  const message = renderManualWhatsApp(entry, { manualWhatsappStartDate: '28th November', whatsappGroupUrl: 'https://link.coachforlife.in/hf-whatsappgroup' });
  assert.ok(message.startsWith('Hello Yogesh'));
  assert.ok(message.includes('*Healthy Forever Batch 39*'));
  assert.ok(message.includes('*Starting from 28th November*'));
  assert.ok(message.includes('*REG-1234*'));
  assert.ok(message.includes('https://link.coachforlife.in/hf-whatsappgroup'));
  assert.ok(!message.includes('{{'));
});
test('custom templates substitute values literally, including dollar characters', () => {
  assert.equal(renderManualWhatsApp({ ...entry, fullName: '$&' }, { manualWhatsappTemplate: 'Hi {{ name }} / {{registration_no}}' }), 'Hi $& / REG-1234');
});
test('WhatsApp links preserve Hindi, emoji, newlines and special characters', () => {
  const message = 'नमस्ते ✅\nA & B #1';
  const url = new URL(manualWhatsAppUrl('+91 98765 43210', message)!);
  assert.equal(url.pathname, '/919876543210');
  assert.equal(url.searchParams.get('text'), message);
  assert.equal(manualWhatsAppUrl('9876543210', message), url.href);
  assert.equal(manualWhatsAppUrl('123', message), null);
  assert.equal(new URL(manualWhatsAppUrl('+65 8123 4567', message)!).pathname, '/6581234567');
  assert.equal(new URL(manualWhatsAppUrl('+971501234567', message)!).pathname, '/971501234567');
});

test('disabled API setting suppresses automatic notifications while manual rendering remains available', async () => {
  const { sendRegistrationConfirmation, sendRegistrationStatusNotifications } = await import('../lib/registration-confirmation.ts');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected provider request'); };
  try {
    const form = { whatsappConfirmationEnabled: false };
    assert.deepEqual(await sendRegistrationConfirmation(entry, form), { configured: false, sent: false });
    assert.deepEqual(await sendRegistrationStatusNotifications(entry, form), {});
    assert.deepEqual(await sendRegistrationStatusNotifications({ ...entry, registrationStatus: 'waiting' }, form), {});
    assert.equal(calls, 0);
    assert.ok(renderManualWhatsApp(entry, form).includes('Hello Yogesh'));
  } finally { globalThis.fetch = originalFetch; }
});
