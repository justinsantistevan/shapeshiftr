export const coachErrors = {
  SESSION_EXPIRED: { status: 401, message: 'Your session has expired. Please sign in again to ask the coach.' },
  INVALID_REQUEST: { status: 400, message: 'Please check your message (1–5000 characters) and try again.' },
  COACH_TIMEOUT: { status: 504, message: 'The AI coach took too long to respond. Please try again.' },
  COACH_BUSY: { status: 503, message: 'The AI coach is busy right now. Please wait a moment and try again.' },
  COACH_UNAVAILABLE: { status: 502, message: 'The AI coach is unavailable right now. Please try again later.' },
} as const;

export function coachErrorResponse(error: unknown, headers: Record<string, string>): Response {
  const code = error instanceof CoachError ? error.code : 'COACH_UNAVAILABLE';
  const { status, message } = coachErrors[code];
  return new Response(JSON.stringify({ code, error: message }), {
    status, headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export class CoachError extends Error {
  constructor(public readonly code: keyof typeof coachErrors) {
    super(coachErrors[code].message);
  }
}
