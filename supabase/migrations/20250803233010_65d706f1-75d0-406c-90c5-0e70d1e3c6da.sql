-- Add goal columns to weekly_fitness_entries table
ALTER TABLE public.weekly_fitness_entries
ADD COLUMN goal_weight numeric,
ADD COLUMN goal_body_fat_percentage numeric,
ADD COLUMN goal_skin_fold_mm numeric,
ADD COLUMN goal_avg_daily_calories integer,
ADD COLUMN goal_avg_exercise_min_per_day integer;