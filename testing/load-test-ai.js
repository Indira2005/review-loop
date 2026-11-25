
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
    text: 'The staff was friendly and the food was excellent. I had a wonderful experience.'
  });

  const response = http.post(
    `${BASE_URL}/api/sentiment`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  check(response, {
    'AI endpoint returns HTTP 200': (r) => r.status === 200,
    'response contains sentiment or fallback': (r) => {
      try {
        const data = JSON.parse(r.body);
        return (
          ['great', 'okay', 'notGreat'].includes(data.sentiment) ||
          data.reason === 'unavailable' ||
          data.reason === 'not_configured'
        );
      } catch {
        return false;
      }
    },
  });

  sleep(3);
}
