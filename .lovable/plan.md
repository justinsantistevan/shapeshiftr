

## Remove Seed Demo Edge Functions

Since the demo user and photos are already set up, we can safely delete these two edge functions to prevent potential abuse.

### Changes

1. **Delete `supabase/functions/seed-demo-user/index.ts`** - Remove the entire directory
2. **Delete `supabase/functions/seed-demo-photos/index.ts`** - Remove the entire directory
3. **Update `supabase/config.toml`** - Remove the `[functions.seed-demo-user]` and `[functions.seed-demo-photos]` sections
4. **Delete deployed functions** from Supabase so they can no longer be called remotely

This is a straightforward cleanup with no impact on the running application since these functions are only used for one-time data seeding.

