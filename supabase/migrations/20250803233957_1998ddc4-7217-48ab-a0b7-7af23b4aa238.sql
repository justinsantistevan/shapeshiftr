-- Add unique constraint on user_id for the user_goals table
ALTER TABLE public.user_goals 
ADD CONSTRAINT user_goals_user_id_unique UNIQUE (user_id);