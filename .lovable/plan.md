

## Pass Full History to AI Coach and Progress Analysis

Currently, both AI features only receive the user's current metrics and a single comparison point (~4 weeks ago). This update sends all historical weekly entries to both edge functions so the AI can discuss long-term trends, week-over-week changes, and any specific past data.

### Changes

**1. `src/components/ProgressAnalysis.tsx`** -- Fetch all historical entries and pass to both function calls

- Before calling `analyze-progress` or `chat-coach`, query `weekly_fitness_entries` for the current user, selecting all metric columns + `week_end_date`, ordered by date descending.
- Add the resulting array as a `history` field in the request body for both the `analyze-progress` call (line 55) and the `chat-coach` call (line 207).

**2. `supabase/functions/analyze-progress/index.ts`** -- Accept history, update prompt for month-focused trend analysis

- Add `history` to the Zod schema as an optional array of objects with `week_end_date`, `weight`, `body_fat_percentage`, `skin_fold_mm`, `avg_daily_calories`, `avg_exercise_min_per_day` (all nullable).
- Inject the history into the user prompt as a formatted table under a "FULL WEEKLY HISTORY" heading.
- **Update the prompt instructions** to shift from a discrete 4-week comparison to a continuous month-long trend assessment:
  - The AI should analyze progress over the past ~4 weeks as a trend (are metrics trending in the right direction? plateauing? fluctuating?)
  - This week's data should be contextualized within that month-long trajectory, not just compared to a single snapshot from 4 weeks ago
  - The AI should still focus on the past month as the primary analysis window, but can reference longer-term trends when relevant
  - It should NOT overemphasize week-to-week changes; instead assess the overall direction and momentum over the month
  - Update the DATA CONTEXT section to explain it now has full history and should use it for trend analysis

**3. `supabase/functions/chat-coach/index.ts`** -- Accept history, inject into system prompt

- Add `history` to the Zod schema (same shape as above).
- Inject the full history table into the system prompt's "Current User Context" section.
- Add a note in the USER CONTEXT section that the AI has access to full weekly history and can reference any past week, identify multi-week trends, discuss plateaus, etc.
- Bump `PROMPT_VERSION` from `v1.3` to `v1.4`.

### Technical Details

| File | Key Changes |
|------|------------|
| `src/components/ProgressAnalysis.tsx` | Add Supabase query for all `weekly_fitness_entries`; pass `history` array to both `analyze-progress` and `chat-coach` invoke calls |
| `supabase/functions/analyze-progress/index.ts` | Add `history` to Zod schema; inject as formatted table in user prompt; rewrite prompt to emphasize month-long trend analysis over discrete comparison |
| `supabase/functions/chat-coach/index.ts` | Add `history` to Zod schema; inject as formatted table in system prompt; bump version to v1.4 |

### Prompt Philosophy Change (Progress Analysis only)

The Progress Analysis prompt will shift from "compare current vs. 4 weeks ago" to "assess the trend over the past month." Specifically:
- Use the past 4 weeks of data points to identify direction and momentum
- Frame this week's metrics within that trajectory (e.g., "Your weight has been steadily declining over the past month, dropping from 168 to 163 lbs")
- Still keep the analysis focused on the past month (not all-time history) unless a longer pattern is especially relevant
- Avoid overweighting any single week-to-week change

