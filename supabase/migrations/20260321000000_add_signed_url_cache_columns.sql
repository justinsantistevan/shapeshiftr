-- Add columns to cache signed URLs and their expiry timestamps
-- to avoid regenerating signed URLs on every page load (reducing storage egress)
ALTER TABLE weekly_fitness_entries
  ADD COLUMN IF NOT EXISTS front_signed_url text,
  ADD COLUMN IF NOT EXISTS front_signed_url_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS side_signed_url text,
  ADD COLUMN IF NOT EXISTS side_signed_url_expires_at timestamptz;
