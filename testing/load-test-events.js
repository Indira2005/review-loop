
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
  const sessionId = `k6-${__VU}-${__ITER}`;

  const eventTypes = [
    'page_view',
    'started',
    'question_answered',
    'finished_questions',
    'copied',
    'google_click',
  ];

  const eventType = eventTypes[__ITER % eventTypes.length];

  const payload = JSON.stringify({
    type: eventType,
    session: sessionId,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(
    `${BASE_URL}/api/public/${BUSINESS_SLUG}/events`,
    payload,
    params
  );

  check(response, {
    'event submission returns HTTP 200': (r) => r.status === 200,
    'event submission succeeds': (r) => {
      try {
        return JSON.parse(r.body).ok === true;
      } catch {
        return false;
      }
    },
  });

  sleep(3);
}
