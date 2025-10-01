import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY'); // legacy (unused)
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stats, goals } = await req.json();

    console.log('Analyzing progress with stats:', stats);
    console.log('User goals:', goals);

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(JSON.stringify({ 
        error: 'AI gateway key is not configured. Please contact support.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an expert fitness coach providing personalized progress analysis. Your role is to:
- Analyze fitness trends over the past month
- Celebrate wins and positive progress toward goals
- Provide constructive coaching for metrics that need attention
- Offer specific, actionable advice
- Be encouraging yet realistic
- Keep your response concise (3-4 sentences max)
- Contextualize the timeline of your analysis, for example "In the last month..." or "Over the previous 4 weeks"

Focus on the trends and how they relate to the user's goals. Be specific about numbers when relevant.`;

    const userPrompt = `Analyze my fitness progress:

Current Metrics & Trends (past month):
- Weight: ${stats.weight.current}${stats.weight.unit}, change: ${stats.weight.change}${stats.weight.unit} (${stats.weight.direction})
- Body Fat: ${stats.bodyFat.current}${stats.bodyFat.unit}, change: ${stats.bodyFat.change}${stats.bodyFat.unit} (${stats.bodyFat.direction})
- Exercise: ${stats.exercise.current}${stats.exercise.unit}, change: ${stats.exercise.change}${stats.exercise.unit} (${stats.exercise.direction})
- Skin Fold: ${stats.skinFold.current}${stats.skinFold.unit}, change: ${stats.skinFold.change}${stats.skinFold.unit} (${stats.skinFold.direction})
- Daily Calories: ${stats.calories.current}${stats.calories.unit}, change: ${stats.calories.change}${stats.calories.unit} (${stats.calories.direction})

My Goals:
${goals.goal_weight ? `- Target Weight: ${goals.goal_weight} lbs` : ''}
${goals.goal_body_fat_percentage ? `- Target Body Fat: ${goals.goal_body_fat_percentage}%` : ''}
${goals.goal_skin_fold_mm ? `- Target Skin Fold: ${goals.goal_skin_fold_mm} mm` : ''}
${goals.goal_avg_daily_calories ? `- Target Daily Calories: ${goals.goal_avg_daily_calories} cal` : ''}
${goals.goal_avg_exercise_min_per_day ? `- Target Exercise: ${goals.goal_avg_exercise_min_per_day} min/day` : ''}

Provide a brief, encouraging yet realistic analysis of my progress.`;

    console.log('Calling Lovable AI Gateway...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    console.log('AI Gateway response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error response:', errorText);
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data, null, 2));
    
    const analysis = data.choices?.[0]?.message?.content;
    
    if (!analysis) {
      console.error('No analysis content in response');
      throw new Error('Failed to generate analysis');
    }

    console.log('Generated analysis:', analysis);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-progress function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
