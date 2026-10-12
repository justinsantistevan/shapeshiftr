// Deno Edge Function - TypeScript configuration for Deno runtime
// @ts-ignore - Deno imports are resolved at runtime
import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore - Deno imports are resolved at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno imports are resolved at runtime
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
// @ts-ignore - Deno imports are resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchPrompt, traceLLMCall } from "../_shared/langfuse.ts";

// @ts-ignore - Deno global is available in Deno runtime
const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
const MODEL = "claude-haiku-5-5";

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
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // @ts-ignore - Deno global is available in Deno runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore - Deno global is available in Deno runtime
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawData = await req.json();
    console.log("Received analysis request - PROMPT v2 (concise 3-4 sentence format)");

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

    const FALLBACK_SYSTEM_PROMPT = `You are an expert fitness coach. You're knowledgeable, direct, warm, and supportive.

FORMAT RULES (STRICT):
- Use 2-3 short paragraphs separated by blank lines. Each paragraph should be 1-2 sentences.
- Use **bold** for key numbers, metric names, and the weekly action. Use sparingly for emphasis, not on every number.
- Keep sentences short and punchy. Maximum 25 words per sentence. Break up complex thoughts into separate sentences.
- Never start with a header, title, or greeting like "Your Coaching Assessment".
- Avoid em-dashes. Use commas, periods, or "to" for ranges (e.g., "4 to 6 weeks" not "4–6 weeks").
- Total response must be under 100 words.

CONTENT - Cover these three beats across 2-3 paragraphs:
1. Overall position: How close to goals? Anchor on the biggest gap.
2. Monthly momentum: Trending toward or away from goals over the past ~4 weeks?
3. One specific action for this week: A concrete behavior, not an outcome.

ANALYSIS PRINCIPLES:
- Base advice on evidence-based fitness and nutrition science
- Focus on actionable behaviors, NOT outcomes
- Frame around distance-to-goal and trajectory
- Treat changes within measurement noise as noise (Weight: <1.5 lbs, Body Fat: <0.8%, Skin Fold: <2mm, Calories: <50 cal, Exercise: <5 min)
- Be specific with numbers
- Prioritize metrics furthest from goal or moving wrong direction
- When fewer than 4 weeks of data exist, focus on current metrics vs. goals

DATA VALIDATION:
Reasonable 4-week ranges: Weight: -20 to +20 lbs | Body Fat: -4% to +4% | Exercise: -120 to +120 min/day | Skin Fold: -10mm to +10mm | Calories: -1000 to +1000 cal
Absolute sanity checks: Weight: 50-400 lbs | Body Fat: 3-60% | Exercise: 0-300 min/day | Skin Fold: 2-70mm | Calories: 800-5000 cal
Flag any violations for verification.

RULES:
- Round percentages to 2 decimal places
- Round exercise minutes and daily calories to whole numbers
- Don't mention data validation unless there's a problem
- Use "week ending" (not "week of") for dates
- Vary your language and structure each time`;

    // Fetch prompt from Langfuse (falls back to hardcoded)
    const langfusePrompt = await fetchPrompt(PROMPT_NAME);
    const systemPrompt = langfusePrompt?.text ?? FALLBACK_SYSTEM_PROMPT;
    const promptVersion = langfusePrompt?.version;

    const userPrompt = `Here are my current fitness metrics and goals:

CURRENT METRICS:
Weight: ${stats.weight.current} ${stats.weight.unit}
Body Fat: ${stats.bodyFat.current}${stats.bodyFat.unit}
Exercise: ${stats.exercise.current} ${stats.exercise.unit}/day
Skin Fold: ${stats.skinFold.current} ${stats.skinFold.unit}
Daily Calories: ${stats.calories.current} ${stats.calories.unit}

MY TARGETS:
${goals.goal_weight ? `Weight: ${goals.goal_weight} lbs (current gap: ${Math.abs(stats.weight.current - goals.goal_weight).toFixed(1)} lbs ${stats.weight.current > goals.goal_weight ? "above" : "below"} target)` : "Weight: no goal set"}
${goals.goal_body_fat_percentage ? `Body Fat: ${goals.goal_body_fat_percentage}% (current gap: ${Math.abs(stats.bodyFat.current - goals.goal_body_fat_percentage).toFixed(1)}% ${stats.bodyFat.current > goals.goal_body_fat_percentage ? "above" : "below"} target)` : "Body Fat: no goal set"}
${goals.goal_skin_fold_mm ? `Skin Fold: ${goals.goal_skin_fold_mm} mm (current gap: ${Math.abs(stats.skinFold.current - goals.goal_skin_fold_mm).toFixed(1)} mm ${stats.skinFold.current > goals.goal_skin_fold_mm ? "above" : "below"} target)` : "Skin Fold: no goal set"}
${goals.goal_avg_daily_calories ? `Daily Calories: ${goals.goal_avg_daily_calories} cal (current gap: ${Math.abs(stats.calories.current - goals.goal_avg_daily_calories)} cal ${stats.calories.current > goals.goal_avg_daily_calories ? "above" : "below"} target)` : "Daily Calories: no goal set"}
${goals.goal_avg_exercise_min_per_day ? `Exercise: ${goals.goal_avg_exercise_min_per_day} min/day (current gap: ${Math.abs(stats.exercise.current - goals.goal_avg_exercise_min_per_day)} min ${stats.exercise.current < goals.goal_avg_exercise_min_per_day ? "below" : "above"} target)` : "Exercise: no goal set"}

${
  history && history.length > 0
    ? `FULL WEEKLY HISTORY (most recent first):
Week Ending | Weight | Body Fat | Skin Fold | Calories | Exercise
${history.map((h) => `${h.week_end_date} | ${h.weight ?? "N/A"} lbs | ${h.body_fat_percentage ?? "N/A"}% | ${h.skin_fold_mm ?? "N/A"} mm | ${h.avg_daily_calories ?? "N/A"} cal | ${h.avg_exercise_min_per_day ?? "N/A"} min`).join("\n")}`
    : "No historical data available yet."
}

Provide your coaching assessment.`;

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
        // Haiku 5.5 thinks by default; reserve room for thinking plus the short answer.
        max_tokens: 2048,
        output_config: { effort: "low" },
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

    if (data.stop_reason === "refusal" || data.stop_reason === "max_tokens") {
      throw new Error("Failed to generate a complete analysis");
    }

    const analysis = data.content
      ?.filter((block: { type: string; text?: string }) => block.type === "text" && typeof block.text === "string")
      .map((block: { text: string }) => block.text)
      .join("\n\n").trim();

    if (!analysis) {
      console.error("No analysis content in response");
      throw new Error("Failed to generate analysis");
    }

    console.log("Generated analysis:", analysis);

    const traceId = await traceLLMCall({
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

    return new Response(JSON.stringify({ analysis, langfuse_trace_id: traceId }), {
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
