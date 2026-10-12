import { CoachError } from './errors.ts';
import { withDeadline } from './deadline.ts';

interface GeminiOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  deadline?: number;
}

function retryAfterMs(value: string | null, now: number): number | null {
  if (!value) return null;
  const milliseconds = /^\d+(\.\d+)?$/.test(value.trim())
    ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : null;
}

export async function generateCoachReply(url: string, body: unknown, options: GeminiOptions = {}) {
  const request = options.fetch ?? fetch;
  const sleep = options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const deadline = options.deadline ?? now() + 25_000;
  return withDeadline(async signal => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal.aborted || now() >= deadline) throw new CoachError('COACH_TIMEOUT');
      let retryAfter: number | null = null;
      let response: Response | undefined;
      try {
        response = await request(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal,
        });
      } catch (error) {
        if (signal.aborted) throw new CoachError('COACH_TIMEOUT');
        if (!(error instanceof TypeError)) throw new CoachError('COACH_UNAVAILABLE');
        // Fetch transport failures are transient; never include their URL/message in errors.
      }
      if (response) {
        if (response.ok) return await response.json();
        const errorText = await response.text();
        retryAfter = retryAfterMs(response.headers.get('Retry-After'), now());
        // Unknown 429s are deliberately not retried. Daily/zero/billing quotas
        // cannot recover in this request even if Google supplies Retry-After.
        const hardQuota = /per[\s_-]*(day|month)|daily|monthly|billing|limit\s*[:=]\s*0\b|"quotaValue"\s*:\s*"?0\b/i.test(errorText);
        const transientRateLimit = response.status === 429 && retryAfter !== null && !hardQuota;
        if (![408, 500, 502, 503, 504].includes(response.status) && !transientRateLimit) {
          throw new CoachError('COACH_UNAVAILABLE');
        }
      }
      if (attempt === 2) throw new CoachError('COACH_BUSY');
      const delay = Math.max(500 * 2 ** attempt + random() * 250, retryAfter ?? 0);
      if (now() + delay >= deadline) throw new CoachError('COACH_TIMEOUT');
      await sleep(delay);
    }
    throw new CoachError('COACH_BUSY');
  }, deadline, now);
}
