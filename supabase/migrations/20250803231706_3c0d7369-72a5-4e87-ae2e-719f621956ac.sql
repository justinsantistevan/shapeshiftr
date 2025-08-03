-- Update the column name from avg_calories_per_week to avg_daily_calories
ALTER TABLE public.weekly_fitness_entries 
RENAME COLUMN avg_calories_per_week TO avg_daily_calories;