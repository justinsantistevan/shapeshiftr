import { CoachError } from './errors.ts';

/** Bounds the entire operation, including body reads. Aborts underlying I/O on exit. */
export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  deadline: number,
  now: () => number = Date.now,
): Promise<T> {
  const remaining = deadline - now();
  if (remaining <= 0) throw new CoachError('COACH_TIMEOUT');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new CoachError('COACH_TIMEOUT'));
          controller.abort();
        }, remaining);
      }),
      operation(controller.signal),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
