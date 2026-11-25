
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 5 },  // Ramp up to 5 users
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '30s', target: 25 }, // Ramp up to 25 users
    { duration: '20s', target: 0 },  // Ramp down
  ],

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL;
const BUSINESS_SLUG = __ENV.BUSINESS_SLUG;

export default function () {
  const response = http.get(`${BASE_URL}/r/${BUSINESS_SLUG}`);

  check(response, {
    'review page returns HTTP 200': (r) => r.status === 200,
    'review page has content': (r) => r.body && r.body.length > 0,
  });

  sleep(2);
}
