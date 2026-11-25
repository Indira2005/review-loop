
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
const BUSINESS_SLUG = __ENV.BUSINESS_SLUG;

export default function () {
  // Test 1: Customer review page
  const pageResponse = http.get(
    `${BASE_URL}/r/${BUSINESS_SLUG}`
  );

  check(pageResponse, {
    'review page returns HTTP 200': (r) => r.status === 200,
  });

  // Test 2: Public business configuration API
  const apiResponse = http.get(
    `${BASE_URL}/api/public/${BUSINESS_SLUG}`
  );

  const apiChecks = check(apiResponse, {
    'public API returns HTTP 200': (r) => r.status === 200,

    'business name exists': (r) => {
      try {
        return Boolean(JSON.parse(r.body).name);
      } catch {
        return false;
      }
    },

    'Google review URL exists': (r) => {
      try {
        return Boolean(JSON.parse(r.body).googleUrl);
      } catch {
        return false;
      }
    },

    'questionnaire configuration exists': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Boolean(data.questions && Object.keys(data.questions).length);
      } catch {
        return false;
      }
    },
  });

  sleep(3);
}
