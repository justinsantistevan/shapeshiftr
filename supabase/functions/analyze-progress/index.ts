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
    console.log("Received analysis request");

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

    const { stats, goals } = validationResult.data;
    console.log("Analyzing progress with validated stats");
    console.log("User goals:", goals);

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
- Prioritize metrics showing concerning trends (moving away from goals or stagnant)
- Be specific with numbers when illustrating points

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

DATA CONTEXT:
The "change" values represent the difference between current metrics and metrics from a comparison period. The ideal comparison is 4 weeks (28-34 days) ago, but if no data exists in that range, the comparison uses the most recent available data that is at least 28 days old. For example, if current weight is 163 lbs with a change of -3 lbs, the user weighed 166 lbs at the comparison point.

IMPORTANT - HANDLING MISSING COMPARISON DATA:
If change values show "N/A", this means there's insufficient historical data (less than 28 days) for comparison. In these cases:
- Acknowledge that trend analysis isn't possible yet due to limited data history
- Focus on analyzing current metrics against the user's goals
- Provide baseline recommendations and guidance for establishing healthy habits
- Encourage the user to continue tracking so future comparisons will be available
- Be supportive and frame this as a starting point, not a limitation

IMPORTANT - COMPARISON CONTEXTUALIZATION:
When providing analysis, you will receive comparison metadata indicating the date and age of the comparison data. If the comparison is not exactly 4 weeks ago (e.g., it's 35+ days old), you MUST contextualize this in your response. For example:
- If comparison is 35-60 days old: "comparing to your latest results from at least 1 month ago" or "the trend from your data from the week of [date]"
- If comparison is 60+ days old: "comparing to your results from [X] months ago" or "the trend from your data from the week of [date]"
- Only mention the comparison timeframe if it's outside the ideal 28-34 day range
- Be natural and conversational when contextualizing - don't make it sound like an error

VARY YOUR APPROACH each time - rotate through different structures:
1. Lead with the biggest concern, then highlight a win
2. Start with overall momentum assessment, then drill into specifics
3. Open with the most impressive achievement, then address gaps
4. Compare multiple metrics to identify patterns (e.g., exercise up but weight stagnant might suggest nutrition focus)
5. Frame around a theme (consistency, intensity, balance, recovery)

COACHING STYLE:
- Use varied language and sentence structures - avoid formulaic patterns
- Balance encouragement with honest assessment
- Make 1-2 specific recommendations tied to the data
- Keep total response to 3-4 sentences
- Reference timeframes naturally ("this past month," "over the last 4 weeks," "recently")
- Be warm and supportive while staying direct and actionable

RULES:
- If your response includes numbers such as percentage changes, round to 2 decimal places, e.g., 3.03% instead of 3.002700001%
- Don't return text that calls explicit attention to your data validation or sanity checks, unless there is a problem. e.g.,never return "It looks like all your data is within reasonable ranges."

Adapt your tone based on overall progress: celebratory for strong progress, motivational for struggles, strategically encouraging for mixed results.`;

    // Helper function to format change values
    const formatChange = (change: number | null, unit: string, direction: string): string => {
      if (change === null) {
        return "N/A";
      }
      return `${change}${unit} ${direction}`;
    };

    const comparisonContext = stats.comparisonDate && stats.comparisonDaysAgo
      ? stats.comparisonDaysAgo >= 28 && stats.comparisonDaysAgo < 35
        ? "" // Ideal range, no need to mention
        : stats.comparisonDaysAgo >= 35 && stats.comparisonDaysAgo < 60
        ? `\n\nCOMPARISON NOTE: These changes are comparing to your data from the week of ${stats.comparisonDate} (approximately ${Math.round(stats.comparisonDaysAgo / 7)} weeks ago).`
        : `\n\nCOMPARISON NOTE: These changes are comparing to your data from the week of ${stats.comparisonDate} (approximately ${Math.round(stats.comparisonDaysAgo / 30)} months ago).`
      : "";

    const hasComparisonData = stats.weight.change !== null || stats.bodyFat.change !== null || 
                             stats.exercise.change !== null || stats.skinFold.change !== null || 
                             stats.calories.change !== null;

    const userPrompt = `Analyze my fitness metrics and goals, then provide coaching:

CURRENT METRICS${hasComparisonData ? " (change from comparison period)" : " (insufficient data for comparison - less than 28 days of history)"}:
Weight: ${stats.weight.current}${stats.weight.unit}${stats.weight.change !== null ? ` (${formatChange(stats.weight.change, stats.weight.unit, stats.weight.direction)})` : " (N/A - no comparison data)"}
Body Fat: ${stats.bodyFat.current}${stats.bodyFat.unit}${stats.bodyFat.change !== null ? ` (${formatChange(stats.bodyFat.change, stats.bodyFat.unit, stats.bodyFat.direction)})` : " (N/A - no comparison data)"}
Exercise: ${stats.exercise.current}${stats.exercise.unit}/day${stats.exercise.change !== null ? ` (${formatChange(stats.exercise.change, stats.exercise.unit, stats.exercise.direction)})` : " (N/A - no comparison data)"}
Skin Fold: ${stats.skinFold.current}${stats.skinFold.unit}${stats.skinFold.change !== null ? ` (${formatChange(stats.skinFold.change, stats.skinFold.unit, stats.skinFold.direction)})` : " (N/A - no comparison data)"}
Daily Calories: ${stats.calories.current}${stats.calories.unit}${stats.calories.change !== null ? ` (${formatChange(stats.calories.change, stats.calories.unit, stats.calories.direction)})` : " (N/A - no comparison data)"}${comparisonContext}

MY TARGETS:
${goals.goal_weight ? `Weight: ${goals.goal_weight} lbs` : ""}
${goals.goal_body_fat_percentage ? `Body Fat: ${goals.goal_body_fat_percentage}%` : ""}
${goals.goal_skin_fold_mm ? `Skin Fold: ${goals.goal_skin_fold_mm} mm` : ""}
${goals.goal_avg_daily_calories ? `Daily Calories: ${goals.goal_avg_daily_calories} cal` : ""}
${goals.goal_avg_exercise_min_per_day ? `Exercise: ${goals.goal_avg_exercise_min_per_day} min/day` : ""}

First validate all metrics are within reasonable ranges. If any data appears questionable, flag it for verification. If all data looks good, provide your coaching assessment (3-4 sentences). Vary your structure and focus from previous analyses.`;

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
