
import http from 'k6/http';
import { check, sleep, fail } from 'k6';

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<15000'],
  },
};

const BASE_URL = __ENV.BASE_URL;
const BUSINESS_SLUG = __ENV.BUSINESS_SLUG;

export default function () {
  if (!BASE_URL || !BUSINESS_SLUG) {
    fail('Missing environment variables.');
  }

  const payload = JSON.stringify({
    businessSlug: BUSINESS_SLUG,
    fragments: [
      {
        id: 'test-1',
        text: 'the staf was realy frendly and the food was exelent'
      },
      {
        id: 'test-2',
        text: 'i realy enjoyed my experiance here'
      }
    ]
  });

  const response = http.post(
    `${BASE_URL}/api/clean`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  check(response, {
    'clean endpoint returns HTTP 200': (r) => r.status === 200,
    'response contains fragments or fallback': (r) => {
      try {
        const data = JSON.parse(r.body);
        return (
          Array.isArray(data.fragments) ||
          data.fragments === null
        );
      } catch {
        return false;
      }
    },
  });

  sleep(3);
}
