import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getCoachErrorMessage, requireCoachReply } from '../src/lib/coachErrors.ts';

for (const [status, code, expected] of [
  [503, 'COACH_BUSY', /busy.*try again/i],
  [504, 'COACH_TIMEOUT', /too long.*try again/i],
  [401, 'SESSION_EXPIRED', /sign in again/i],
  [400, 'INVALID_REQUEST', /check your message/i],
  [502, 'COACH_UNAVAILABLE', /unavailable.*try again/i],
] as const) {
  test(`UI reads ${code} from a real Supabase FunctionsHttpError context`, async () => {
    const context = Response.json({ code, error: 'private diagnostics' }, { status });
    const message = await getCoachErrorMessage(new FunctionsHttpError(context));
    assert.match(message, expected);
    assert.doesNotMatch(message, /private diagnostics/);
    assert.equal(context.bodyUsed, false);
  });
}

test('UI handles gateway session errors with no application code', async () => {
  assert.match(await getCoachErrorMessage(new FunctionsHttpError(Response.json({ message: 'Invalid JWT' }, { status: 401 }))), /sign in again/i);
});

test('UI safely falls back for malformed bodies, legacy errors and unknown diagnostics', async () => {
  for (const error of [new Error('private diagnostics'), { error: 'private diagnostics' }, new FunctionsHttpError(new Response('not json', { status: 500 })), { code: 'constructor', error: 'private diagnostics' }, null]) {
    assert.match(await getCoachErrorMessage(error), /try again/i);
    assert.doesNotMatch(await getCoachErrorMessage(error), /private diagnostics|not json/);
  }
});

test('successful coach reply and metadata pass through unchanged', () => {
  const data = { reply: 'Keep going.', metadata: { llm_model: 'configured-model', tokens_total: 12 } };
  assert.equal(requireCoachReply(data, null), data);
});

test('invoke errors, legacy HTTP-200 errors and malformed successes enter the safe catch path', async () => {
  const httpError = new FunctionsHttpError(Response.json({ code: 'COACH_BUSY' }, { status: 503 }));
  assert.throws(() => requireCoachReply(null, httpError), error => error === httpError);
  for (const data of [{ code: 'COACH_BUSY', error: 'private' }, { error: 'private' }, null, {}, { reply: 42 }]) {
    assert.throws(() => requireCoachReply(data, null));
  }
  assert.match(await getCoachErrorMessage({ code: 'COACH_BUSY', error: 'private' }), /busy/i);
});
