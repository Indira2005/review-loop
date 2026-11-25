
import http from 'k6/http';
import { check, sleep, fail } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 2 },
    { duration: '30s', target: 3 },
    { duration: '30s', target: 5 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL;
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;
const BUSINESS_ID = '73e1beef-8f39-4325-86d4-aba6cdb5359a';

export function setup() {
  if (!BASE_URL || !TEST_EMAIL || !TEST_PASSWORD) {
    fail('Missing environment variables.');
  }

  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(response, {
    'login returns HTTP 200': (r) => r.status === 200,
  });

  const cookie = response.cookies['sayit.sid']?.[0]?.value;

  if (!cookie) {
    fail('Login succeeded but session cookie was not found.');
  }

  return { cookie };
}

export default function (data) {
  const params = {
    headers: {
      Cookie: `sayit.sid=${data.cookie}`,
    },
  };

  const response = http.get(
    `${BASE_URL}/api/dashboard/businesses/${BUSINESS_ID}/stats`,
    params
  );

  check(response, {
    'analytics API returns HTTP 200': (r) => r.status === 200,
    'analytics response is valid JSON': (r) => {
      try {
        return typeof JSON.parse(r.body) === 'object';
      } catch {
        return false;
      }
    },
  });

  sleep(5);
}
