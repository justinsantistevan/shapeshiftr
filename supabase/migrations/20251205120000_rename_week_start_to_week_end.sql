-- Rename week_start_date to week_end_date to reflect that
-- entries represent the end of the tracked week rather than the start.

BEGIN;

-- Rename the column on the core table
ALTER TABLE public.weekly_fitness_entries
  RENAME COLUMN week_start_date TO week_end_date;

-- If an old unique constraint name exists that references week_start_date,
-- drop it and recreate a clearer one for (user_id, week_end_date).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'weekly_fitness_entries_user_id_week_start_date_key'
  ) THEN
    ALTER TABLE public.weekly_fitness_entries
      DROP CONSTRAINT weekly_fitness_entries_user_id_week_start_date_key;
  END IF;
END$$;

ALTER TABLE public.weekly_fitness_entries
  ADD CONSTRAINT weekly_fitness_entries_user_id_week_end_date_key
  UNIQUE (user_id, week_end_date);

COMMIT;
