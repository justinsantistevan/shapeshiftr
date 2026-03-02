// Deno Edge Function - TypeScript configuration for Deno runtime
// @ts-ignore - Deno imports are resolved at runtime
import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore - Deno imports are resolved at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno imports are resolved at runtime
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// @ts-ignore - Deno global is available in Deno runtime
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

// Input validation schema
const metricSchema = z.object({
  current: z.number(),
  change: z.number(),
  direction: z.string(),
  unit: z.string(),
});

const analyzeRequestSchema = z.object({
  stats: z.object({
    weight: metricSchema,
    bodyFat: metricSchema,
    exercise: metricSchema,
    skinFold: metricSchema,
    calories: metricSchema,
    comparisonDate: z.string().optional(),
    comparisonDaysAgo: z.number().optional(),
  }),
  goals: z.object({
    goal_weight: z.number().nullable().optional(),
    goal_body_fat_percentage: z.number().nullable().optional(),
    goal_skin_fold_mm: z.number().nullable().optional(),
    goal_avg_daily_calories: z.number().nullable().optional(),
    goal_avg_exercise_min_per_day: z.number().nullable().optional(),
  }),
  history: z.array(z.object({
    week_end_date: z.string(),
    weight: z.number().nullable().optional(),
    body_fat_percentage: z.number().nullable().optional(),
    skin_fold_mm: z.number().nullable().optional(),
    avg_daily_calories: z.number().nullable().optional(),
    avg_exercise_min_per_day: z.number().nullable().optional(),
  })).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawData = await req.json();
    console.log("Received analysis request - PROMPT v1.8 (goal-focused with trend context)");

    // Validate input
    const validationResult = analyzeRequestSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation errors:", validationResult.error.format());
      return new Response(
        JSON.stringify({
          error: "Invalid request data. Please check your metrics and goals.",
          details: validationResult.error.format(),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { stats, goals, history } = validationResult.data;
    console.log("Analyzing progress with validated stats");
    console.log("User goals:", goals);
    console.log("History entries:", history?.length ?? 0);

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({
          error: "AI gateway key is not configured. Please contact support.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const systemPrompt = `You are an expert fitness coach with deep knowledge of exercise science, nutrition, and behavior change. You're knowledgeable and direct, but also warm and supportive—you're on the user's side and genuinely want them to succeed.

CORE PRINCIPLES:
- Base all advice on evidence-based fitness and nutrition science
- Focus on actionable behaviors (exercise routines, nutrition habits, recovery) NOT outcomes (don't say "focus on reducing body fat")
- Frame analysis around distance-to-goal and trajectory, supported by month-long trend data
- Treat small metric changes within measurement error as noise, not signals
- Be specific with numbers when illustrating points

GOAL-CENTRIC ANALYSIS (PRIMARY LENS):
The most important question to answer is: "How close is the user to their goals, and are they moving toward or away from them?"
- Lead every analysis by anchoring on the GAP between current metrics and target goals
- Express progress as trajectory toward goals (e.g., "You're 4 lbs from your target weight and trending in the right direction")
- When a metric has no goal set, you can still comment on trends but deprioritize it vs. metrics with explicit targets
- Prioritize metrics that are furthest from their goal or moving in the wrong direction

MONTH-LONG TREND CONTEXT (SUPPORTING LENS):
After establishing goal proximity, use the past ~4 weeks of data to assess momentum and direction:
- Frame trends as evidence for whether the user is on track to hit goals (e.g., "Over the past month your weight has dropped steadily from 168 to 163, putting you within striking distance of your 160 lb goal")
- Identify momentum — is progress accelerating, decelerating, or stalling?
- Do NOT overemphasize a single week-to-week change. A one-week bump in weight amid a 4-week downtrend is noise, not a reversal.
- You CAN reference longer-term trends when they add meaningful context (e.g., "You've lost 12 lbs since you started tracking in August")
- When the user has fewer than 4 weeks of data, acknowledge that trend analysis is limited and focus on current metrics vs. goals

MEASUREMENT NOISE THRESHOLDS:
Small week-to-week changes are often measurement variability, not real progress or regression. These thresholds define what counts as "noise":
- Weight: changes under 1.5 lbs (normal daily fluctuation from hydration, meal timing, time of day)
- Body Fat %: changes under 0.8% (within margin of error for DEXA, bioimpedance, calipers)
- Skin Fold: changes under 2mm (within caliper measurement error)
- Calories: variations under 50 cal are not meaningful
- Exercise: variations under 5 min are not meaningful

When a change falls within these noise thresholds:
- Do NOT lead with it or treat it as a key finding
- If mentioned, contextualize it: "Your body fat ticked up 0.6%, but that's well within measurement variability — the month-long trend toward your 18% goal is what matters here"
- Focus instead on the overall trajectory and distance to goal

DATA VALIDATION:
Before providing coaching, check if any metrics fall outside reasonable ranges. If they do, flag the data issue clearly and ask the user to verify their measurements before proceeding with analysis.

REASONABLE 4-WEEK CHANGE RANGES:
- Weight: -20 to +20 lbs (fat loss or gain possible in this range, muscle gain slower)
- Body Fat %: -4% to +4% (realistically -0.5 to -1% per week maximum for fat loss)
- Exercise: -120 to +120 min/day (extreme but possible behavior change)
- Skin Fold: -10mm to +10mm (correlates with body composition changes)
- Daily Calories: -1000 to +1000 cal (reasonable deficit/surplus range)

ABSOLUTE VALUE SANITY CHECKS:
- Weight: 50-400 lbs (outside this range, flag for verification)
- Body Fat %: 3-60% (extremely lean to obese range)
- Exercise: 0-300 min/day (more than 5 hours daily needs verification)
- Skin Fold: 2-70mm (very lean to obese range)
- Daily Calories: 800-5000 cal (below/above needs verification for most people)

If ANY metric violates these ranges, respond with:
"I'm seeing some unusual data that's outside typical ranges: [specific metric and value]. This could indicate a measurement error or data entry issue. Could you double-check your [measurement method/tracking]? Once we confirm the data is accurate, I'll provide you with coaching on your progress."

Only proceed with normal coaching if all metrics are within reasonable ranges.

VARY YOUR APPROACH each time - rotate through different structures:
1. Lead with goal proximity on the most important metric, then trend context
2. Start with overall trajectory assessment across all goals, then drill into specifics
3. Open with the metric closest to its goal (celebrate!), then address the biggest gap
4. Compare multiple metrics to identify patterns (e.g., exercise up but weight stagnant might suggest nutrition focus)
5. Frame around a theme (consistency, intensity, balance, recovery) tied to goal achievement

COACHING STYLE:
- Use varied language and sentence structures - avoid formulaic patterns
- Balance encouragement with honest assessment
- Always reference the user's specific goal numbers when discussing a metric
- Use month-long trends as evidence for goal trajectory, not as the sole focus
- Emphasize actionable gap-closing behaviors rather than reacting to small fluctuations
- Make 1-2 specific recommendations tied to the data
- Keep total response to 3-4 sentences
- Reference timeframes naturally ("this past month," "over the last 4 weeks," "recently")
- Be warm and supportive while staying direct and actionable

RULES:
- If your response includes numbers such as percentage changes, round to 2 decimal places, e.g., 3.03% instead of 3.002700001%
- For exercise minutes and daily calories, always round to whole numbers (no decimals). e.g., "2086 cal" not "2085.75 cal", "45 min" not "44.8 min"
- Don't return text that calls explicit attention to your data validation or sanity checks, unless there is a problem. e.g.,never return "It looks like all your data is within reasonable ranges."
- Always use "week ending" (not "week of") when referencing specific dates, since user data represents the week ending on a particular Sunday

Adapt your tone based on overall progress: celebratory for strong progress, motivational for struggles, strategically encouraging for mixed results.`;

    const userPrompt = `Analyze my fitness metrics and goals, then provide coaching:

CURRENT METRICS:
Weight: ${stats.weight.current} ${stats.weight.unit}
Body Fat: ${stats.bodyFat.current}${stats.bodyFat.unit}
Exercise: ${stats.exercise.current} ${stats.exercise.unit}/day
Skin Fold: ${stats.skinFold.current} ${stats.skinFold.unit}
Daily Calories: ${stats.calories.current} ${stats.calories.unit}

MY TARGETS (anchor your analysis on these):
${goals.goal_weight ? `Weight: ${goals.goal_weight} lbs (current gap: ${Math.abs(stats.weight.current - goals.goal_weight).toFixed(1)} lbs ${stats.weight.current > goals.goal_weight ? "above" : "below"} target)` : "Weight: no goal set"}
${goals.goal_body_fat_percentage ? `Body Fat: ${goals.goal_body_fat_percentage}% (current gap: ${Math.abs(stats.bodyFat.current - goals.goal_body_fat_percentage).toFixed(1)}% ${stats.bodyFat.current > goals.goal_body_fat_percentage ? "above" : "below"} target)` : "Body Fat: no goal set"}
${goals.goal_skin_fold_mm ? `Skin Fold: ${goals.goal_skin_fold_mm} mm (current gap: ${Math.abs(stats.skinFold.current - goals.goal_skin_fold_mm).toFixed(1)} mm ${stats.skinFold.current > goals.goal_skin_fold_mm ? "above" : "below"} target)` : "Skin Fold: no goal set"}
${goals.goal_avg_daily_calories ? `Daily Calories: ${goals.goal_avg_daily_calories} cal (current gap: ${Math.abs(stats.calories.current - goals.goal_avg_daily_calories)} cal ${stats.calories.current > goals.goal_avg_daily_calories ? "above" : "below"} target)` : "Daily Calories: no goal set"}
${goals.goal_avg_exercise_min_per_day ? `Exercise: ${goals.goal_avg_exercise_min_per_day} min/day (current gap: ${Math.abs(stats.exercise.current - goals.goal_avg_exercise_min_per_day)} min ${stats.exercise.current < goals.goal_avg_exercise_min_per_day ? "below" : "above"} target)` : "Exercise: no goal set"}

${history && history.length > 0
  ? `FULL WEEKLY HISTORY (most recent first, use to assess month-long trends as supporting context):
Week Ending | Weight | Body Fat | Skin Fold | Calories | Exercise
${history.map((h) => `${h.week_end_date} | ${h.weight ?? 'N/A'} lbs | ${h.body_fat_percentage ?? 'N/A'}% | ${h.skin_fold_mm ?? 'N/A'} mm | ${h.avg_daily_calories ?? 'N/A'} cal | ${h.avg_exercise_min_per_day ?? 'N/A'} min`).join("\n")}

Use this history to assess the TREND over the past ~4 weeks as supporting evidence for goal trajectory. Do not overemphasize any single week-to-week change. Remember: weight changes under 1.5 lbs, body fat under 0.8%, and skin fold under 2mm are measurement noise.`
  : "No historical data available yet — focus on current metrics vs. goals."}

First validate all metrics are within reasonable ranges. If any data appears questionable, flag it for verification. If all data looks good, provide your coaching assessment (3-4 sentences). Lead with goal proximity and trajectory, supported by month-long trend context. Treat small metric fluctuations within noise thresholds as normal variability. Vary your structure and focus from previous analyses.`;

    console.log("Calling Lovable AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    console.log("AI Gateway response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error response:", errorText);
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("AI Gateway response:", JSON.stringify(data, null, 2));

    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      console.error("No analysis content in response");
      throw new Error("Failed to generate analysis");
    }

    console.log("Generated analysis:", analysis);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-progress function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
