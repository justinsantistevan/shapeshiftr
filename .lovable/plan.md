

## Fix: Restore Edge Function Config and Force Deployment

### Root Cause

When the Supabase project was connected, `supabase/config.toml` was overwritten to contain only `project_id`. The function declarations (`[functions.analyze-progress]`, `[functions.chat-coach]`, `[functions.update-goals]`) were removed. This is why the updated v1.7 edge function code has never been deployed -- the old versions are still running on Supabase.

Evidence from the logs: The deployed function still logs `"Received analysis request"` instead of `"Received analysis request - PROMPT v1.7 (no pre-computed changes)"`.

### Changes

**1. `supabase/config.toml`** -- Restore function declarations

Add back the three function configurations:

```toml
project_id = "nkeiuyejylpiinffmoxx"

[functions.analyze-progress]
verify_jwt = true

[functions.chat-coach]
verify_jwt = true

[functions.update-goals]
verify_jwt = true
```

**2. Deploy edge functions**

Use the deploy tool to immediately deploy all three edge functions (`analyze-progress`, `chat-coach`, `update-goals`) so the v1.7 code goes live.

**3. Verify deployment**

After deployment, check the edge function logs to confirm the `"PROMPT v1.7"` version string appears, and that `"History entries:"` shows a non-zero count.

### Expected Outcome

Once deployed, the AI coach and progress analysis will:
- Receive the full weekly history table in the prompt
- Calculate week-over-week and trend comparisons from the raw data
- No longer anchor on pre-computed 4-week change values

