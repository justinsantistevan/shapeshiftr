import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const bundle = await build({
  entryPoints: ['supabase/functions/chat-coach/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
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
function harness(options: { env?: Record<string, string>; fetch?: typeof fetch; authenticated?: boolean } = {}) {
  let handler: Handler;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const env: Record<string, string> = { GEMINI_API_KEY: 'test-only', SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'test-only', ...options.env };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    Deno: { env: { get: (name: string) => env[name] } },
    captureHandler: (fn: Handler) => { handler = fn; },
    mockClient: () => ({ auth: { getClaims: async () => ({ data: options.authenticated === false ? null : { claims: { sub: 'test-user' } } }) } }),
    fetch: async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return options.fetch ? options.fetch(url, init) : Response.json({ candidates: [{ content: { parts: [{ text: 'Keep going.' }] } }], usageMetadata: { totalTokenCount: 12 } });
    },
    Request, Response, Headers, AbortController, setTimeout, clearTimeout, crypto, btoa,
    console: { log() {}, error() {} },
  });
  return { requests, call: (body = JSON.stringify({ message: 'Advice please' }), auth = true) => handler(new Request('https://example.test/chat-coach', {
    method: 'POST', headers: auth ? { Authorization: 'Bearer test-token' } : {}, body,
  })) };
}

test('handler uses new default model while preserving reply and metadata', async () => {
  const app = harness();
  const response = await app.call();
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.reply, 'Keep going.');
  assert.equal(data.metadata.llm_model, 'gemini-3.5-flash-lite');
  assert.equal(data.metadata.tokens_total, 12);
  assert.match(app.requests[0].url, /models\/gemini-3\.5-flash-lite:generateContent/);
  const body = JSON.parse(app.requests[0].init!.body as string);
  assert.equal(body.contents.at(-1).parts[0].text, 'Advice please');
});

test('handler supports CHAT_COACH_MODEL override', async () => {
  const app = harness({ env: { CHAT_COACH_MODEL: 'custom-model' } });
  const data = await (await app.call()).json();
  assert.equal(data.metadata.llm_model, 'custom-model');
  assert.match(app.requests[0].url, /models\/custom-model:generateContent/);
});

test('missing or expired user sessions return a safe session code without calling Google', async () => {
  for (const authenticated of [true, false]) {
    const app = harness({ authenticated });
    const response = await app.call(undefined, !authenticated);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'SESSION_EXPIRED');
    assert.equal(app.requests.length, 0);
  }
});

test('invalid schema and malformed JSON return safe input errors without validation diagnostics', async () => {
  for (const body of ['{broken', '{}', JSON.stringify({ message: 'x'.repeat(5001) })]) {
    const app = harness();
    const response = await app.call(body);
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.code, 'INVALID_REQUEST');
    assert.equal(data.details, undefined);
    assert.equal(app.requests.length, 0);
  }
});

test('upstream authentication failure is not reported as a user-session error or leaked', async () => {
  const app = harness({ fetch: async () => new Response('private upstream diagnostics', { status: 403 }) });
  const response = await app.call();
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.equal(data.code, 'COACH_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(data), /private upstream/);
  assert.equal(app.requests.length, 1);
});

test('handler returns a safe 503 after overload exhaustion, with CORS intact', async () => {
  const app = harness({ fetch: async () => new Response('private upstream diagnostics', { status: 503 }) });
  const response = await app.call();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  const data = await response.json();
  assert.equal(data.code, 'COACH_BUSY');
  assert.doesNotMatch(JSON.stringify(data), /private upstream/);
  assert.equal(app.requests.length, 3);
});

test('handler recovers from overload and returns a normal successful reply', async () => {
  let calls = 0;
  const app = harness({ fetch: async () => ++calls === 1 ? new Response('', { status: 503 })
    : Response.json({ candidates: [{ content: { parts: [{ text: 'Recovered.' }] } }] }) });
  const response = await app.call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, 'Recovered.');
  assert.equal(calls, 2);
});

test('handler sanitizes malformed/empty model responses and missing configuration', async () => {
  for (const app of [
    harness({ fetch: async () => Response.json({}) }),
    harness({ fetch: async () => new Response('private malformed JSON') }),
    harness({ env: { GEMINI_API_KEY: '' } }),
  ]) {
    const response = await app.call();
    assert.equal(response.status, 502);
    const data = await response.json();
    assert.equal(data.code, 'COACH_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(data), /private|API key|JSON/);
  }
});

test('handler bounds unavailable Langfuse prompt and trace calls without losing the reply', { timeout: 6000 }, async () => {
  const signals: AbortSignal[] = [];
  const app = harness({ env: { LANGFUSE_PUBLIC_KEY: 'test', LANGFUSE_SECRET_KEY: 'test' }, fetch: async (url, init) => {
    if (String(url).includes('langfuse')) {
      if (init?.signal) signals.push(init.signal);
      return new Promise(() => {});
    }
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Keep going.' }] } }] });
  } });
  const data = await (await app.call()).json();
  assert.equal(data.reply, 'Keep going.');
  assert.equal(data.metadata.langfuse_trace_id, null);
  assert.equal(signals.length, 2);
  assert.ok(signals.every(signal => signal.aborted));
});
