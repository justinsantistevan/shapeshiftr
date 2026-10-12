import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const bundle = await build({
  entryPoints: ['supabase/functions/analyze-progress/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'edge-runtime-test', setup(build) {
    build.onResolve({ filter: /^https:/ }, args => args.path.includes('/zod@')
      ? { path: require.resolve('zod') } : { path: args.path, namespace: 'edge-stubs' });
    build.onLoad({ filter: /.*/, namespace: 'edge-stubs' }, args => ({ contents:
      args.path.includes('/http/server.ts') ? 'export const serve = globalThis.captureHandler;'
      : args.path.includes('supabase-js') ? 'export const createClient = globalThis.mockClient;'
      : '', loader: 'js' }));
  }}],
});
type Handler = (request: Request) => Promise<Response>;
function harness(payload = { content: [{ type: 'text', text: 'Keep going.' }], stop_reason: 'end_turn' }) {
  let handler: Handler;
  const requests: Array<Record<string, unknown>> = [];
  vm.runInNewContext(bundle.outputFiles[0].text, {
    Deno: { env: { get: (name: string) => ({ CLAUDE_API_KEY: 'test-only', SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'test-only' }[name]) } },
    captureHandler: (fn: Handler) => { handler = fn; },
    mockClient: () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: 'test-user' } } }) } }),
    fetch: async (_url: string, init: RequestInit) => { requests.push(JSON.parse(init.body as string)); return Response.json(payload); },
    Request, Response, Headers, crypto, btoa, console: { log() {}, error() {} },
  });
  const metric = { current: 160, change: 1, direction: 'down', unit: 'lbs' };
  return { requests, call: (body?: unknown) => handler(new Request('https://example.test/analyze-progress', {
    method: 'POST', headers: { Authorization: 'Bearer test-token' },
    body: JSON.stringify(body ?? { stats: { weight: metric, bodyFat: { ...metric, current: 15, unit: '%' }, exercise: { ...metric, current: 45, unit: 'min' }, skinFold: { ...metric, current: 20, unit: 'mm' }, calories: { ...metric, current: 1800, unit: 'cal' } }, goals: {} }),
  })) };
}
test('progress analysis requests Haiku 5.5 and preserves its response contract', async () => {
  const app = harness();
  const response = await app.call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analysis, 'Keep going.');
  assert.equal(app.requests[0].model, 'claude-haiku-5-5');
});
test('analysis selects text blocks after thinking and reserves a low-effort thinking budget', async () => {
  const app = harness({ content: [{ type: 'thinking', text: 'Never display this.' }, { type: 'text', text: 'First paragraph.' }, { type: 'text', text: 'Second paragraph.' }], stop_reason: 'end_turn' });
  const response = await app.call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analysis, 'First paragraph.\n\nSecond paragraph.');
  assert.deepEqual(app.requests[0].output_config, { effort: 'low' });
  assert.equal(app.requests[0].max_tokens, 2048);
});
test('analysis does not present refusals or truncated output as a completed assessment', async () => {
  for (const reason of ['refusal', 'max_tokens']) {
    const app = harness({ content: [{ type: 'text', text: 'Incomplete assessment.' }], stop_reason: reason });
    const response = await app.call();
    assert.equal(response.status, 500);
    const data = await response.json();
    assert.equal(data.analysis, undefined);
    assert.equal(data.error, 'Failed to generate a complete analysis');
  }
});

function partialRequest() {
  const missing: { current: number | null; change: number | null; direction: string; unit: string } = { current: null, change: null, direction: 'neutral', unit: 'min' };
  return { stats: { weight: { current: 180, change: null, direction: 'neutral', unit: 'lbs' }, bodyFat: { current: 22, change: null, direction: 'neutral', unit: '%' }, exercise: missing, skinFold: { ...missing, unit: 'mm' }, calories: { ...missing, unit: 'cal' } }, goals: { goal_weight: 170, goal_body_fat_percentage: 20, goal_skin_fold_mm: 15, goal_avg_exercise_min_per_day: 30 } };
}
test('partial weekly metrics reach the provider rather than failing validation', async () => {
  const app = harness();
  const response = await app.call(partialRequest());
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).analysis, 'Keep going.');
  assert.equal(app.requests.length, 1);
});
test('partial metrics stay missing and do not produce fabricated gaps or trends', async () => {
  const app = harness();
  await app.call(partialRequest());
  const prompt = (app.requests[0].messages as Array<{ content: string }>)[0].content;
  assert.match(prompt, /Weight: 180 lbs/);
  assert.match(prompt, /Body Fat: 22\s*%/);
  assert.match(prompt, /Exercise: not recorded/);
  assert.match(prompt, /Skin Fold: not recorded/);
  assert.match(prompt, /current gap: 10.0 lbs above target/);
  assert.match(prompt, /gap unavailable/);
  assert.match(prompt, /Weight: comparison unavailable/);
  assert.doesNotMatch(prompt, /null|Exercise: 0|Skin Fold: 0/);
  assert.match(app.requests[0].system as string, /Missing measurements are unknown, not zero/);
});
test('recorded zero and sparse dated history remain distinct from missing values', async () => {
  const body = partialRequest();
  body.stats.exercise = { current: 0, change: 0, direction: 'neutral', unit: 'min' };
  const app = harness();
  const response = await app.call({ ...body, stats: { ...body.stats, weight: { ...body.stats.weight, change: -4 }, comparisonDate: '2026-08-17', comparisonDaysAgo: 56 }, history: [
    { week_end_date: '2026-10-12', weight: 180, body_fat_percentage: 22, avg_exercise_min_per_day: 0, skin_fold_mm: null },
    { week_end_date: '2026-08-17', weight: 184, body_fat_percentage: null, avg_exercise_min_per_day: 0 },
  ] });
  assert.equal(response.status, 200);
  const prompt = (app.requests[0].messages as Array<{ content: string }>)[0].content;
  assert.match(prompt, /Exercise: 0 min\/day/);
  assert.match(prompt, /current gap: 30.0 min\/day below target/);
  assert.match(prompt, /Weight: signed change -4 lbs since week ending 2026-08-17, over 56 days/);
  assert.match(prompt, /Body Fat: comparison unavailable/);
  assert.match(prompt, /2026-08-17 \| 184 lbs \| N\/A%/);
});
test('nullable metrics do not weaken validation of malformed or incomplete metric objects', async () => {
  for (const metric of [{ current: '180', change: null, direction: 'neutral', unit: 'lbs' }, { current: 180, direction: 'neutral', unit: 'lbs' }]) {
    const body = partialRequest();
    const app = harness();
    const response = await app.call({ ...body, stats: { ...body.stats, weight: metric } });
    assert.equal(response.status, 400);
    assert.equal(app.requests.length, 0);
  }
});
