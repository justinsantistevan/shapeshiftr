-- Add langfuse_trace_id to coach_chat_logs for bi-directional linking
-- with Langfuse traces, enabling feedback scores to be posted back to Langfuse.

ALTER TABLE public.coach_chat_logs
  ADD COLUMN IF NOT EXISTS langfuse_trace_id text NULL;

CREATE INDEX IF NOT EXISTS idx_coach_chat_logs_langfuse_trace_id
  ON public.coach_chat_logs (langfuse_trace_id)
  WHERE langfuse_trace_id IS NOT NULL;
