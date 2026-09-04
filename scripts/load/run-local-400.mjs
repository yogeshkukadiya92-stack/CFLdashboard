import { performance } from 'node:perf_hooks';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3120';
const adminEmail = process.env.LOAD_ADMIN_EMAIL;
const adminPassword = process.env.LOAD_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) throw new Error('Set LOAD_ADMIN_EMAIL and LOAD_ADMIN_PASSWORD');

const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.2' },
  body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  redirect: 'manual',
});
if (!loginResponse.ok) throw new Error(`Test login failed with ${loginResponse.status}`);
const cookie = loginResponse.headers.getSetCookie?.()[0]?.split(';')[0] || loginResponse.headers.get('set-cookie')?.split(';')[0];
if (!cookie) throw new Error('Test login did not return a session cookie');

const journeys = [
  { path: '/', name: 'dashboard', weight: 45 },
  { path: '/api/dashboard-summary', name: 'dashboard-summary', weight: 30 },
  { path: '/api/public-registration-state', name: 'public-state', weight: 15 },
  { path: '/login', name: 'login-page', weight: 10 },
];
const allStages = [
  { name: 'smoke', users: 5, durationMs: 5_000 },
  { name: 'baseline', users: 50, durationMs: 10_000 },
  { name: 'ramp-100', users: 100, durationMs: 12_000 },
  { name: 'ramp-200', users: 200, durationMs: 15_000 },
  { name: 'target-400', users: 400, durationMs: 20_000 },
];
const requestedStages = new Set((process.env.LOAD_STAGES || '').split(',').filter(Boolean));
const selectedStages = requestedStages.size
  ? allStages.filter((stage) => requestedStages.has(stage.name))
  : allStages;
const userOverride = Number(process.env.LOAD_USERS || 0);
const stages = userOverride > 0
  ? selectedStages.map((stage) => ({ ...stage, users: userOverride }))
  : selectedStages;

function selectJourney() {
  const roll = Math.random() * 100;
  let cursor = 0;
  return journeys.find((journey) => {
    cursor += journey.weight;
    return roll < cursor;
  }) || journeys[0];
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function runStage(stage) {
  const deadline = performance.now() + stage.durationMs;
  const results = [];
  const byJourney = new Map();
  let activeRequests = 0;
  let peakActiveRequests = 0;

  async function virtualUser() {
    while (performance.now() < deadline) {
      const journey = selectJourney();
      const startedAt = performance.now();
      activeRequests += 1;
      peakActiveRequests = Math.max(peakActiveRequests, activeRequests);
      let status = 0;
      let error = '';
      try {
        const response = await fetch(`${baseUrl}${journey.path}`, {
          headers: { cookie },
          redirect: 'manual',
          signal: AbortSignal.timeout(10_000),
        });
        status = response.status;
        await response.arrayBuffer();
        const expectedStatus = journey.name === 'login-page' ? 307 : 200;
        if (status !== expectedStatus) error = `HTTP_${status}`;
      } catch (requestError) {
        const causeCode = requestError?.cause?.code;
        error = [requestError?.name || 'REQUEST_ERROR', causeCode].filter(Boolean).join(':');
      } finally {
        activeRequests -= 1;
      }
      const row = { duration: performance.now() - startedAt, error, journey: journey.name, status };
      results.push(row);
      const journeyRows = byJourney.get(journey.name) || [];
      journeyRows.push(row);
      byJourney.set(journey.name, journeyRows);
      const thinkMs = 250 + Math.random() * 750;
      await new Promise((resolve) => setTimeout(resolve, thinkMs));
    }
  }

  const stageStartedAt = performance.now();
  await Promise.all(Array.from({ length: stage.users }, () => virtualUser()));
  const elapsedSeconds = (performance.now() - stageStartedAt) / 1000;
  const durations = results.map((row) => row.duration);
  const errors = results.filter((row) => row.error);
  const summary = {
    stage: stage.name,
    users: stage.users,
    durationSeconds: +elapsedSeconds.toFixed(2),
    requests: results.length,
    requestsPerSecond: +(results.length / elapsedSeconds).toFixed(2),
    peakActiveRequests,
    errorRate: +(errors.length / Math.max(1, results.length) * 100).toFixed(3),
    p50Ms: +percentile(durations, 0.5).toFixed(2),
    p90Ms: +percentile(durations, 0.9).toFixed(2),
    p95Ms: +percentile(durations, 0.95).toFixed(2),
    p99Ms: +percentile(durations, 0.99).toFixed(2),
    maxMs: +Math.max(0, ...durations).toFixed(2),
    errors: Object.fromEntries(Object.entries(Object.groupBy(errors, (row) => row.error)).map(([key, rows]) => [key, rows.length])),
    journeys: Object.fromEntries([...byJourney.entries()].map(([name, rows]) => [name, {
      requests: rows.length,
      errors: rows.filter((row) => row.error).length,
      p95Ms: +percentile(rows.map((row) => row.duration), 0.95).toFixed(2),
    }])),
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return summary;
}

for (const stage of stages) {
  const summary = await runStage(stage);
  if (summary.errorRate > 5 || summary.p95Ms > 3000) {
    process.stderr.write(`STOP_CONDITION ${stage.name}\n`);
    process.exitCode = 2;
    break;
  }
}
