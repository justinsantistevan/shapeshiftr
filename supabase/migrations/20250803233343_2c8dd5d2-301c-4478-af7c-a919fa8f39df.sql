-- Remove goal columns from weekly_fitness_entries table
ALTER TABLE public.weekly_fitness_entries
DROP COLUMN IF EXISTS goal_weight,
DROP COLUMN IF EXISTS goal_body_fat_percentage,
DROP COLUMN IF EXISTS goal_skin_fold_mm,
DROP COLUMN IF EXISTS goal_avg_daily_calories,
DROP COLUMN IF EXISTS goal_avg_exercise_min_per_day;

-- Create a separate goals table for persistent user goals
CREATE TABLE public.user_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  goal_weight numeric,
  goal_body_fat_percentage numeric,
  goal_skin_fold_mm numeric,
  goal_avg_daily_calories integer,
  goal_avg_exercise_min_per_day integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for user goals
CREATE POLICY "Users can view their own goals" 
ON public.user_goals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals" 
ON public.user_goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
ON public.user_goals 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" 
ON public.user_goals 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_user_goals_updated_at
BEFORE UPDATE ON public.user_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();