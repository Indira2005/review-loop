
import http from 'k6/http';
import { check, sleep } from 'k6';

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

// Log in once before the virtual users begin.
export function setup() {
  if (!BASE_URL || !TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error('Missing environment variables.');
  }

  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const loginPassed = check(response, {
    'login returns HTTP 200': (r) => r.status === 200,
  });

  if (!loginPassed) {
    throw new Error(`Login failed. HTTP status: ${response.status}`);
  }

  const cookies = response.cookies['sayit.sid'];

  if (!cookies || !cookies[0]?.value) {
    throw new Error('Login succeeded but session cookie was not found.');
  }

  return {
    sessionCookie: cookies[0].value,
  };
}

export default function (data) {
  const params = {
    headers: {
      Cookie: `sayit.sid=${data.sessionCookie}`,
    },
  };

  // Test 1: Does the server recognize the authenticated user?
  const meResponse = http.get(
    `${BASE_URL}/api/auth/me`,
    params
  );

  check(meResponse, {
    '/api/auth/me returns HTTP 200': (r) => r.status === 200,
    'authenticated user email exists': (r) => {
      try {
        return Boolean(JSON.parse(r.body).email);
      } catch {
        return false;
      }
    },
  });

  // Test 2: Can the authenticated user access their businesses?
  const businessResponse = http.get(
    `${BASE_URL}/api/dashboard/businesses`,
    params
  );

  check(businessResponse, {
    'dashboard API returns HTTP 200': (r) => r.status === 200,
    'dashboard returns a valid business list': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });

  sleep(5);
}
