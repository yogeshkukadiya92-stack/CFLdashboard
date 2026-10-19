import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncCoursePaymentToMfw } from '../lib/mfw-course-payment.ts';

test('relays original signature and body; fails on downstream outage for provider retry', async () => {
 const originalFetch = globalThis.fetch;
 const originalBase = process.env.MFW_API_BASE_URL;
 const originalKey = process.env.MFW_INTEGRATION_API_KEY;
 process.env.MFW_API_BASE_URL = 'https://mfw.example';
 process.env.MFW_INTEGRATION_API_KEY = 'test-only';
 try {
  globalThis.fetch = async (url, init) => {
   assert.equal(url, 'https://mfw.example/integrations/v1/course-payments/cfl');
   assert.deepEqual(JSON.parse(String(init?.body)), { rawBody: '{ "signed": true }', signature: 'signature' });
   return Response.json({ success: true, data: { courseAssigned: true } });
  };
  assert.deepEqual(await syncCoursePaymentToMfw('{ "signed": true }', 'signature'), { assigned: true, skipped: false });
  globalThis.fetch = async () => Response.json({ success: false }, { status: 503 });
  await assert.rejects(syncCoursePaymentToMfw('{}', 'sig'), /pending/);
  globalThis.fetch = async () => Response.json({ success: true, skipped: true });
  assert.equal((await syncCoursePaymentToMfw('{}', 'sig')).skipped, true);
 } finally {
  globalThis.fetch = originalFetch;
  if (originalBase === undefined) delete process.env.MFW_API_BASE_URL; else process.env.MFW_API_BASE_URL = originalBase;
  if (originalKey === undefined) delete process.env.MFW_INTEGRATION_API_KEY; else process.env.MFW_INTEGRATION_API_KEY = originalKey;
 }
});
