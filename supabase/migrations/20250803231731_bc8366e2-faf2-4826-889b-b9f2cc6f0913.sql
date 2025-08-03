-- Drop the old fitness_entries table
DROP TABLE IF EXISTS public.fitness_entries;

-- Create new weekly_fitness_entries table with correct metrics
CREATE TABLE public.weekly_fitness_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  weight NUMERIC,
  body_fat_percentage NUMERIC,
  skin_fold_mm NUMERIC,
  avg_daily_calories INTEGER,
  avg_exercise_min_per_day INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

-- Enable Row Level Security
ALTER TABLE public.weekly_fitness_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own weekly entries" 
ON public.weekly_fitness_entries 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own weekly entries" 
ON public.weekly_fitness_entries 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly entries" 
ON public.weekly_fitness_entries 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weekly entries" 
ON public.weekly_fitness_entries 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_weekly_fitness_entries_updated_at
BEFORE UPDATE ON public.weekly_fitness_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();