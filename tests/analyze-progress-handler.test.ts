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
  return { requests, call: () => handler(new Request('https://example.test/analyze-progress', {
    method: 'POST', headers: { Authorization: 'Bearer test-token' },
    body: JSON.stringify({ stats: { weight: metric, bodyFat: { ...metric, current: 15, unit: '%' }, exercise: { ...metric, current: 45, unit: 'min' }, skinFold: { ...metric, current: 20, unit: 'mm' }, calories: { ...metric, current: 1800, unit: 'cal' } }, goals: {} }),
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
