

## Fix: Update Langfuse Host to US Region

### Problem
The Langfuse integration is failing with 401 "Invalid credentials. Confirm that you've configured the correct host." This is because the host is hardcoded to `https://cloud.langfuse.com` (EU region), but your Langfuse project is in the **US region**.

### Solution
Update the `LANGFUSE_HOST` constant in `supabase/functions/_shared/langfuse.ts`.

### Change

**File: `supabase/functions/_shared/langfuse.ts`** (line 8)

Change:
```
const LANGFUSE_HOST = "https://cloud.langfuse.com";
```
To:
```
const LANGFUSE_HOST = "https://us.cloud.langfuse.com";
```

### Verification
After deploying, trigger an LLM call (e.g., use Ask Coach or load the dashboard to trigger analyze-progress). Then check:
1. Edge function logs should show `[langfuse] Trace recorded: ...` instead of the 401 error
2. Traces should appear in your Langfuse dashboard at https://us.cloud.langfuse.com

### Additional Check
If it still fails after this fix, the `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` secrets may need to be re-set. You can verify them in your Langfuse project under Settings > API Keys.

