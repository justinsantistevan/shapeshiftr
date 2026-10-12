import { FunctionsHttpError } from '@supabase/supabase-js';

const messages: Record<string, string> = {
  COACH_BUSY: 'The AI coach is busy right now. Please wait a moment and try again.',
  COACH_TIMEOUT: 'The AI coach took too long to respond. Please try again.',
  COACH_UNAVAILABLE: 'The AI coach is unavailable right now. Please try again later.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again to ask the coach.',
  INVALID_REQUEST: 'Please check your message (1–5000 characters) and try again.',
};
const fallback = "Sorry, I'm having trouble responding right now. Please try again later.";

/** Only allowlisted codes/statuses become UI text; never display provider diagnostics. */
export async function getCoachErrorMessage(error: unknown): Promise<string> {
  let payload = error;
  let status: number | undefined;
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    status = error.context.status;
    try {
      payload = await error.context.clone().json();
    } catch {
      payload = null;
    }
  }
  if (status === 401 || status === 403) return messages.SESSION_EXPIRED;
  if (payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string'
      && Object.prototype.hasOwnProperty.call(messages, payload.code)) {
    return messages[payload.code];
  }
  if (status === 429 || status === 503) return messages.COACH_BUSY;
  if (status === 504) return messages.COACH_TIMEOUT;
  if (status === 400) return messages.INVALID_REQUEST;
  return fallback;
}

interface CoachReply {
  reply: string;
  metadata?: {
    llm_model?: string;
    system_prompt_version?: string;
    langfuse_trace_id?: string;
    tokens_input?: number;
    tokens_output?: number;
    tokens_total?: number;
  };
}

/** Route both HTTP errors and legacy HTTP-200 error envelopes into one catch path. */
export function requireCoachReply(data: unknown, error: unknown): CoachReply {
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data) throw data;
  if (!data || typeof data !== 'object' || !('reply' in data) || typeof data.reply !== 'string' || !data.reply.trim()) {
    throw new Error('Invalid coach response');
  }
  return data as CoachReply;
}
