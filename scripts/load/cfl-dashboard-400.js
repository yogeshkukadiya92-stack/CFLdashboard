import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL;
if (!baseUrl) throw new Error('Set BASE_URL to an authorized non-production target');

export const options = {
  scenarios: {
    concurrent_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 5 },
        { duration: '30s', target: 50 },
        { duration: '45s', target: 200 },
        { duration: '1m', target: 400 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const paths = [
    { path: '/', journey: 'dashboard', weight: 45 },
    { path: '/api/dashboard-summary', journey: 'dashboard-summary', weight: 30 },
    { path: '/api/public-registration-state', journey: 'public-state', weight: 15 },
    { path: '/login', journey: 'login-page', weight: 10 },
  ];
  const roll = Math.random() * 100;
  let cursor = 0;
  const selected = paths.find((item) => {
    cursor += item.weight;
    return roll < cursor;
  }) || paths[0];
  const response = http.get(`${baseUrl}${selected.path}`, {
    cookies: __ENV.AUTH_COOKIE ? { cfl_admin_session: __ENV.AUTH_COOKIE } : undefined,
    redirects: 0,
    tags: { journey: selected.journey },
    timeout: '10s',
  });

  check(response, {
    'status matches journey': (r) => selected.journey === 'login-page' ? r.status === 307 : r.status === 200,
    'body is not empty': (r) => r.body && r.body.length > 0,
  });

  sleep(1 + Math.random() * 2);
}
