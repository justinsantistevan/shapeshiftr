// Deno Edge Function - TypeScript configuration for Deno runtime
// @ts-ignore - Deno imports are resolved at runtime
import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore - Deno imports are resolved at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno imports are resolved at runtime
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { fetchPrompt, traceLLMCall } from "../_shared/langfuse.ts";

// @ts-ignore - Deno global is available in Deno runtime
const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";

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
  history: z
    .array(
      z.object({
        week_end_date: z.string(),
        weight: z.number().nullable().optional(),
        body_fat_percentage: z.number().nullable().optional(),
        skin_fold_mm: z.number().nullable().optional(),
        avg_daily_calories: z.number().nullable().optional(),
        avg_exercise_min_per_day: z.number().nullable().optional(),
      }),
    )
    .optional(),
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
    console.log("Received analysis request - PROMPT v1.5 (goal-focused with trend context)");

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

    if (!claudeApiKey) {
      console.error("CLAUDE_API_KEY is not configured");
      return new Response(
        JSON.stringify({
          error: "AI API key is not configured. Please contact support.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const PROMPT_NAME = "analyze-progress-system";

    const FALLBACK_SYSTEM_PROMPT = `You are an expert fitness coach with deep knowledge of exercise science, nutrition, and behavior change. You're knowledgeable and direct, but also warm and supportive—you're on the user's side and genuinely want them to succeed.

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
- Frame trends as evidence for whether the user is on track to hit goals
- Identify momentum — is progress accelerating, decelerating, or stalling?
- Do NOT overemphasize a single week-to-week change.
- You CAN reference longer-term trends when they add meaningful context
- When the user has fewer than 4 weeks of data, acknowledge that trend analysis is limited and focus on current metrics vs. goals

MEASUREMENT NOISE THRESHOLDS:
- Weight: changes under 1.5 lbs
- Body Fat %: changes under 0.8%
- Skin Fold: changes under 2mm
- Calories: variations under 50 cal
- Exercise: variations under 5 min

When a change falls within these noise thresholds:
- Do NOT lead with it or treat it as a key finding
- Focus instead on the overall trajectory and distance to goal

DATA VALIDATION:
REASONABLE 4-WEEK CHANGE RANGES:
- Weight: -20 to +20 lbs | Body Fat: -4% to +4% | Exercise: -120 to +120 min/day | Skin Fold: -10mm to +10mm | Calories: -1000 to +1000 cal

ABSOLUTE VALUE SANITY CHECKS:
- Weight: 50-400 lbs | Body Fat: 3-60% | Exercise: 0-300 min/day | Skin Fold: 2-70mm | Calories: 800-5000 cal

If ANY metric violates these ranges, flag it for verification before proceeding.

VARY YOUR APPROACH each time - rotate through different structures.

COACHING STYLE:
- Use varied language and sentence structures
- Balance encouragement with honest assessment
- Always reference the user's specific goal numbers
- Make 1-2 specific recommendations tied to the data
- Keep it brief and to the point: keep total response to 2-3 sentences
- Be warm and supportive while staying direct and actionable

RULES:
- Round percentages to 2 decimal places
- For exercise minutes and daily calories, always round to whole numbers
- Don't call attention to data validation unless there is a problem
- Always use "week ending" (not "week of") when referencing specific dates`;

    // Fetch prompt from Langfuse (falls back to hardcoded)
    const langfusePrompt = await fetchPrompt(PROMPT_NAME);
    const systemPrompt = langfusePrompt?.text ?? FALLBACK_SYSTEM_PROMPT;
    const promptVersion = langfusePrompt?.version;

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

${
  history && history.length > 0
    ? `FULL WEEKLY HISTORY (most recent first):
Week Ending | Weight | Body Fat | Skin Fold | Calories | Exercise
${history.map((h) => `${h.week_end_date} | ${h.weight ?? "N/A"} lbs | ${h.body_fat_percentage ?? "N/A"}% | ${h.skin_fold_mm ?? "N/A"} mm | ${h.avg_daily_calories ?? "N/A"} cal | ${h.avg_exercise_min_per_day ?? "N/A"} min`).join("\n")}

Use this history to assess the TREND over the past ~4 weeks as supporting evidence for goal trajectory.`
    : "No historical data available yet — focus on current metrics vs. goals."
}

Provide your coaching assessment (3-4 sentences). Lead with goal proximity and trajectory, supported by month-long trend context.`;

    console.log("Calling Anthropic API...");
    const traceStartTime = Date.now();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const traceEndTime = Date.now();
    console.log("Anthropic API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error response:", errorText);

      await traceLLMCall({
        name: "analyze-progress",
        model: MODEL,
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        output: null,
        startTime: traceStartTime,
        endTime: traceEndTime,
        promptName: PROMPT_NAME,
        promptVersion,
        error: `Anthropic API error: ${response.status} - ${errorText}`,
      });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "The AI analysis is busy right now. Please wait a moment and try again." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Anthropic API response received");

    const analysis = data.content?.[0]?.text;

    if (!analysis) {
      console.error("No analysis content in response");
      throw new Error("Failed to generate analysis");
    }

    console.log("Generated analysis:", analysis);

    await traceLLMCall({
      name: "analyze-progress",
      model: MODEL,
      systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      output: analysis,
      startTime: traceStartTime,
      endTime: traceEndTime,
      promptName: PROMPT_NAME,
      promptVersion,
      usage: data.usage,
    });

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
