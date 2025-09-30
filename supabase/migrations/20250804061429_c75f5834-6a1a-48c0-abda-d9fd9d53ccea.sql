-- Add order field to user_affirmations table
ALTER TABLE public.user_affirmations 
ADD COLUMN display_order integer DEFAULT 0;

-- Update existing affirmations to have sequential order based on creation date
UPDATE public.user_affirmations 
SET display_order = sub.row_number
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as row_number
  FROM public.user_affirmations
) sub
WHERE public.user_affirmations.id = sub.id;