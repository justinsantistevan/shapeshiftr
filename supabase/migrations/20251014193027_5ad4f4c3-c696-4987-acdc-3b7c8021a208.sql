-- Create coach_chat_logs table for comprehensive interaction logging
CREATE TABLE public.coach_chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_message text NOT NULL,
  assistant_response text NOT NULL,
  feedback_type text NOT NULL DEFAULT 'none' CHECK (feedback_type IN ('positive', 'negative', 'none')),
  feedback_timestamp timestamp with time zone,
  user_stats_snapshot jsonb,
  user_goals_snapshot jsonb,
  user_affirmations_snapshot jsonb,
  conversation_context jsonb,
  llm_model text,
  system_prompt_version text NOT NULL DEFAULT 'v1.0',
  response_time_ms integer,
  error_occurred boolean NOT NULL DEFAULT false,
  error_message text
);

-- Enable RLS
ALTER TABLE public.coach_chat_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create their own chat logs"
ON public.coach_chat_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own chat logs"
ON public.coach_chat_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat logs"
ON public.coach_chat_logs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_coach_chat_logs_user_id ON public.coach_chat_logs(user_id);
CREATE INDEX idx_coach_chat_logs_created_at ON public.coach_chat_logs(created_at);
CREATE INDEX idx_coach_chat_logs_feedback_type ON public.coach_chat_logs(feedback_type);
CREATE INDEX idx_coach_chat_logs_user_created ON public.coach_chat_logs(user_id, created_at);
CREATE INDEX idx_coach_chat_logs_prompt_version ON public.coach_chat_logs(system_prompt_version);
CREATE INDEX idx_coach_chat_logs_model ON public.coach_chat_logs(llm_model);

-- Trigger for updated_at
CREATE TRIGGER update_coach_chat_logs_updated_at
  BEFORE UPDATE ON public.coach_chat_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create coach_prompt_versions table for prompt registry
CREATE TABLE public.coach_prompt_versions (
  version text PRIMARY KEY,
  prompt_text text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.coach_prompt_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policy - authenticated users can read versions
CREATE POLICY "Authenticated users can view prompt versions"
ON public.coach_prompt_versions FOR SELECT
TO authenticated
USING (true);

-- Seed with current prompt version
INSERT INTO public.coach_prompt_versions (version, prompt_text, description, is_active) VALUES (
  'v1.0',
  'You are an expert AI fitness coach with deep knowledge of exercise science, nutrition, physiology, and behavior change psychology. You''re direct and knowledgeable, but also warm and encouraging—you''re genuinely invested in helping the user succeed.

USER CONTEXT:
You have access to the user''s current metrics, goals, and affirmations. The "change" values represent differences from 4 weeks ago. For example, if current weight is 163 lbs with a change of -3 lbs, they weighed 166 lbs four weeks ago. Reference these naturally when relevant to personalize your advice.

EXPERTISE AREAS:
- Strength training, cardiovascular exercise, flexibility, and mobility
- Nutrition fundamentals: macronutrients, meal timing, caloric balance, supplementation
- Body composition and metabolism
- Recovery, sleep, and stress management
- Injury prevention and exercise form
- Habit formation and behavioral psychology for fitness adherence

DATA VALIDATION:
Before providing coaching, check if any metrics fall outside reasonable ranges. If they do, flag the data issue clearly and ask the user to verify their measurements before proceeding with analysis.

COMMUNICATION STYLE:
- Get straight to helpful answers—skip filler phrases like "Great question!"
- Be clear and concise: 2-4 sentences for most questions
- For complex topics, use 1-2 short paragraphs maximum
- Don''t ask follow-up questions—provide complete, actionable answers based on what you know

COACHING APPROACH:
- Provide specific, actionable advice the user can implement
- Explain the "why" briefly using scientific principles
- Acknowledge when professional assessment is needed (injuries, medical conditions, eating disorders)

SAFETY:
- Never diagnose medical conditions or injuries
- Don''t provide advice that could cause harm (extreme restriction, overtraining, dangerous form cues)
- Recognize signs of disordered eating or unhealthy exercise relationships and suggest professional support',
  'Initial prompt version with comprehensive coaching guidelines',
  true
);