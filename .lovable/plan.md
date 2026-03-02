## Create Demo User with Seed Data

### Approach

Create a one-time-use edge function (`seed-demo-user`) that uses the Supabase Admin API to create the demo user account and populate it with realistic mock data. After running it once to seed the data, we can keep or remove the function.

**Demo credentials:**

- Email: `demo-user@shapeshiftr.app`
- Password: `Password123`

### Edge Function: `supabase/functions/seed-demo-user/index.ts`

This function will:

1. **Create the auth user** via `supabase.auth.admin.createUser()` with email confirmation auto-set
2. **Insert user_goals** -- realistic targets for someone actively cutting body fat:
  - Goal weight: 158 lbs
  - Goal body fat: 14%
  - Goal skin fold: 18mm
  - Goal avg daily calories: 1800
  - Goal avg exercise min/day: 45
3. **Insert ~12 weeks of weekly_fitness_entries** (roughly 3 months of history) with a realistic progression arc -- someone who started slightly overweight and is gradually improving:
  - Weight: starts ~172 lbs, trends down to ~156 lbs with small weekly fluctuations
  - Body fat: starts ~18.5%, trends down to ~14.5%
  - Skin fold: starts ~25mm, trends down to ~19mm
  - Calories: varies 1750-2300, generally trending toward the 1800 goal
  - Exercise: varies 30-70 min/day
  - Notes: varied weekly observations
  - No photos (to avoid needing to generate/upload images)
4. **Insert user_affirmations** -- 7 motivational affirmations with display_order

### Data Design

The mock data will tell a believable story: a person making steady but imperfect progress. Some weeks will show slight backslides (holidays, busy weeks), but the overall 3-month trend is clearly positive. This gives the charts meaningful shape and the AI coach something substantive to analyze.

Week dates will be Sundays going back ~12 weeks from today.

### Execution Steps

1. Create the edge function file
2. Deploy it
3. Call it once via curl to seed the data
4. Verify the user exists and data is populated
5. Optionally display the demo credentials on the login page (can be a follow-up)

### Technical Notes

- The function uses `SUPABASE_SERVICE_ROLE_KEY` (already configured as a secret) to call `auth.admin.createUser`
- `verify_jwt` will be set to `false` in config.toml for this function so it can be called without auth
- The function will check if the demo user already exists to prevent duplicate creation
- Week end dates use Sundays as the app expects