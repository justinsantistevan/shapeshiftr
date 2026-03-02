

## Fix: Remove Pre-computed Change Values from Both Edge Functions

### Root Cause

The `analyze-progress` edge function still injects pre-computed 4-week `change`, `direction`, and `comparisonDate` values directly into the AI prompt (lines 164-179). The AI sees explicit numbers like "(0.5lbs down)" and uses those instead of computing comparisons from the history table. The `chat-coach` function was partially fixed but the `stats` schema still accepts `change`/`direction` fields.

Both the Progress Analysis output AND the AI Coach are anchoring on these pre-computed values because the AI treats them as authoritative.

### Changes

**1. `supabase/functions/analyze-progress/index.ts`** -- Remove change values from prompt, show only current metrics

- Remove the `formatChange` helper function (lines 156-162)
- Remove the `comparisonContext` variable (lines 164-166) and `hasComparisonData` check (lines 168-170)
- Rewrite the user prompt (lines 172-179) to show ONLY current metric values (no change/direction parentheticals)
- The AI should derive ALL comparisons from the FULL WEEKLY HISTORY table, which is already being injected
- Keep the `metricSchema` accepting `change`/`direction` in Zod (to avoid breaking validation of the incoming `stats` object from the client), but simply don't use those fields in the prompt

**2. `supabase/functions/chat-coach/index.ts`** -- Remove `change`/`direction` from Zod metricSchema

- Simplify `metricSchema` (lines 17-24) to only require `current` and `unit` (make `change` and `direction` optional so the incoming data doesn't fail validation)
- Confirm the system prompt only shows current values (already done)
- Bump `PROMPT_VERSION` to `v1.6` to force fresh deployment

**3. `supabase/functions/analyze-progress/index.ts`** -- Also strip `comparisonDate`/`comparisonDaysAgo` from schema usage

- Make `comparisonDate` and `comparisonDaysAgo` optional in the schema (already optional) but ensure they are not used in the prompt at all

### What the updated analyze-progress prompt will look like

```text
CURRENT METRICS:
Weight: 156 lbs
Body Fat: 14.5%
Exercise: 58 min/day
Skin Fold: 21 mm
Daily Calories: 2110 cal

MY TARGETS:
...

FULL WEEKLY HISTORY (most recent first):
Week Ending | Weight | Body Fat | Skin Fold | Calories | Exercise
2026-03-01 | 156 lbs | 14.5% | 21 mm | 2110 cal | 58 min
2026-02-22 | 156.5 lbs | 13.8% | 21 mm | 2147 cal | 69 min
...

Use this history to assess the TREND over the past ~4 weeks...
```

No pre-computed change values anywhere. The AI must look at the history table rows and calculate differences itself.

### Technical Details

| File | Changes |
|------|---------|
| `supabase/functions/analyze-progress/index.ts` | Remove `formatChange`, `comparisonContext`, `hasComparisonData`. Rewrite user prompt to show only current values. Keep Zod schema accepting `change`/`direction` (unused). |
| `supabase/functions/chat-coach/index.ts` | Make `change`/`direction` optional in `metricSchema`. Bump `PROMPT_VERSION` to `v1.6`. |

After these changes, you will need to **publish the app** to deploy the updated edge functions.
