

## Update Progress Analysis Prompt: Goal-Focused with Trend Context

### What Changes

Update the system prompt in `supabase/functions/analyze-progress/index.ts` to rebalance coaching: lead with **goal proximity and trajectory**, but still incorporate **month-long trend analysis** as supporting context. Treat small metric fluctuations as measurement noise.

### Specific Prompt Modifications

**1. Add "GOAL-CENTRIC ANALYSIS" section** as the PRIMARY lens:

- Lead every analysis with: "How close am I to my goals, and am I moving toward or away from them?"
- Calculate the gap between current metrics and targets -- this is the anchor
- Express progress as trajectory toward goals (e.g., "You're 4 lbs from your target weight and trending in the right direction")

**2. Keep "MONTH-LONG TREND FOCUS" section** but reposition it as SUPPORTING context:

- After establishing goal proximity, use the past ~4 weeks of data to assess momentum and direction
- Frame trends as evidence for whether the user is on track to hit goals (e.g., "Over the past month your weight has dropped steadily from 168 to 163, putting you within striking distance of your 160 lb goal")
- Continue to avoid overemphasizing single week-to-week changes; look at the arc of the month

**3. Add "MEASUREMENT NOISE" section** to define thresholds:

- Weight: changes under 1.5 lbs week-to-week are normal daily fluctuation (hydration, meal timing, time of day)
- Body Fat %: changes under 0.8% are within margin of error for most body composition tools (DEXA, bioimpedance, calipers)
- Skin Fold: changes under 2mm are within caliper measurement error
- Calories and Exercise: small variations (under 50 cal or 5 min) are not meaningful

When a change falls within these noise thresholds:
- Do NOT lead with it or treat it as a key finding
- If mentioned, contextualize it: "Your body fat ticked up 0.6%, but that's well within measurement variability -- the month-long trend is what matters here"
- Focus instead on the overall trajectory and distance to goal

**4. Update CORE PRINCIPLES** to add:
- "Frame analysis around distance-to-goal and trajectory, supported by month-long trend data"
- "Treat small metric changes within measurement error as noise, not signals"

**5. Update COACHING STYLE** to add:
- "Always reference the user's specific goal numbers when discussing a metric"
- "Use month-long trends as evidence for goal trajectory, not as the sole focus"
- "Emphasize actionable gap-closing behaviors rather than reacting to small fluctuations"

**6. Reorder the user prompt** so TARGETS appear before HISTORY, reinforcing goal-first analysis.

### Technical

- File: `supabase/functions/analyze-progress/index.ts`
- Bump the log message to `PROMPT v1.8` for deployment verification
- Deploy the `analyze-progress` edge function after editing

### Expected Outcome

The Progress Analysis will:
- Lead with goal proximity ("You're X away from your target")
- Support with month-long trend data ("Over the past 4 weeks, you've been steadily moving toward/away from that goal")
- Treat sub-threshold changes as noise rather than findings
- Provide motivating, goal-anchored coaching that still acknowledges momentum and trends

