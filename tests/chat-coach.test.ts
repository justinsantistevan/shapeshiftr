import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCoachReply } from '../supabase/functions/chat-coach/gemini.ts';

test('honors Retry-After seconds and HTTP dates instead of retrying early', async () => {
  for (const header of ['2', 'Thu, 01 Jan 1970 00:00:02 GMT']) {
    let calls = 0;
    const waits: number[] = [];
    await generateCoachReply('https://example.test', {}, {
      fetch: async () => ++calls === 1 ? new Response('', { status: 503, headers: { 'Retry-After': header } }) : Response.json(success),
      sleep: async ms => { waits.push(ms); }, now: () => 0, deadline: 5000, random: () => 0,
    });
    assert.deepEqual(waits, [2000]);
  }
});

test('retries explicitly transient 429 but not hard quota even with Retry-After', async () => {
  for (const [body, expectedCalls] of [
    ['rate limit per minute', 2],
    ['Quota exceeded: requestsPerDay', 1],
    ['Quota exceeded: requestsPerMonth', 1],
    ['Quota exceeded, limit: 0', 1],
    ['billing account disabled', 1],
  ] as const) {
    let calls = 0;
    const result = generateCoachReply('https://example.test', {}, {
      fetch: async () => ++calls === 1 ? new Response(body, { status: 429, headers: { 'Retry-After': '1' } }) : Response.json(success),
      sleep: async () => {},
    });
    if (expectedCalls === 1) await assert.rejects(result, { code: 'COACH_UNAVAILABLE' });
    else await result;
    assert.equal(calls, expectedCalls);
  }
});

test('network transport failure recovers without exposing request URL', async () => {
  let calls = 0;
  await generateCoachReply('https://example.test', {}, {
    fetch: async () => { if (++calls === 1) throw new TypeError('fetch failed: secret URL'); return Response.json(success); },
    sleep: async () => {},
  });
  assert.equal(calls, 2);
});

test('deadline prevents waiting beyond budget or starting a new attempt', async () => {
  let calls = 0;
  await assert.rejects(generateCoachReply('https://example.test', {}, {
    fetch: async () => { calls++; return new Response('', { status: 503, headers: { 'Retry-After': '60' } }); },
    now: () => 0, deadline: 1000, sleep: async () => assert.fail('must not wait'),
  }), { code: 'COACH_TIMEOUT' });
  assert.equal(calls, 1);
});

test('overall deadline aborts a stalled request', async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(generateCoachReply('https://example.test', {}, {
    fetch: async (_url, init) => { signal = init?.signal ?? undefined; return new Promise(() => {}); },
    deadline: Date.now() + 20,
  }), { code: 'COACH_TIMEOUT' });
  assert.equal(signal?.aborted, true);
});

test('overall deadline covers a stalled response body, not only response headers', async () => {
  await assert.rejects(generateCoachReply('https://example.test', {}, {
    fetch: async () => new Response(new ReadableStream({ start() {} })),
    deadline: Date.now() + 20,
  }), { code: 'COACH_TIMEOUT' });
});

const success = { candidates: [{ content: { parts: [{ text: 'Keep going.' }] } }], usageMetadata: { totalTokenCount: 12 } };

test('Google 503 overload recovers on a bounded retry, preserving successful payload', async () => {
  let calls = 0;
  const waits: number[] = [];
  const result = await generateCoachReply('https://example.test', {}, {
    fetch: async () => ++calls === 1 ? new Response('overloaded', { status: 503 }) : Response.json(success),
    sleep: async ms => { waits.push(ms); }, random: () => 0,
  });
  assert.deepEqual(result, success);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [500]);
});

test('exhaustion returns a safe busy code after three attempts and exponential jittered waits', async () => {
  let calls = 0;
  const waits: number[] = [];
  await assert.rejects(generateCoachReply('https://example.test', {}, {
    fetch: async () => { calls++; return new Response('sensitive upstream diagnostics', { status: 503 }); },
    sleep: async ms => { waits.push(ms); }, random: () => 0.5,
  }), { code: 'COACH_BUSY', message: 'The AI coach is busy right now. Please wait a moment and try again.' });
  assert.equal(calls, 3);
  assert.deepEqual(waits, [625, 1125]);
});

for (const status of [400, 401, 403, 404, 429]) {
  test(`does not retry upstream ${status} or leak its diagnostics`, async () => {
    let calls = 0;
    await assert.rejects(generateCoachReply('https://example.test', {}, {
      fetch: async () => { calls++; return new Response('private credentials or quota', { status }); },
      sleep: async () => assert.fail('must not sleep'),
    }), { code: 'COACH_UNAVAILABLE' });
    assert.equal(calls, 1);
  });
}

for (const status of [408, 500, 502, 504]) {
  test(`retries transient HTTP ${status}`, async () => {
    let calls = 0;
    await generateCoachReply('https://example.test', {}, {
      fetch: async () => ++calls === 1 ? new Response('', { status }) : Response.json(success),
      sleep: async () => {},
    });
    assert.equal(calls, 2);
  });
}

