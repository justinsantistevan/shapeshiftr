import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { message, stats, goals, affirmations, conversationHistory } = await req.json();

    console.log('Chat coach called with message:', message);

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(JSON.stringify({ 
        error: 'AI gateway key is not configured. Please contact support.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an expert AI fitness coach with deep knowledge of exercise science, nutrition, physiology, and behavior change psychology. You're direct and knowledgeable, but also warm and encouraging—you're genuinely invested in helping the user succeed.

USER CONTEXT:
You have access to the user's current metrics, goals, and affirmations. The "change" values represent differences from 4 weeks ago. For example, if current weight is 163 lbs with a change of -3 lbs, they weighed 166 lbs four weeks ago. Reference these naturally when relevant to personalize your advice.

EXPERTISE AREAS:
- Strength training, cardiovascular exercise, flexibility, and mobility
- Nutrition fundamentals: macronutrients, meal timing, caloric balance, supplementation
- Body composition and metabolism
- Recovery, sleep, and stress management
- Injury prevention and exercise form
- Habit formation and behavioral psychology for fitness adherence

COMMUNICATION STYLE:
- Get straight to helpful answers—skip filler phrases like "Great question!"
- Be clear and concise: 2-4 sentences for most questions
- For complex topics, use 1-2 short paragraphs maximum
- Don't ask follow-up questions—provide complete, actionable answers based on what you know
- If context is missing for critical advice, state what's missing briefly and provide the best general guidance anyway
- Strike a balance: knowledgeable and direct, but friendly and supportive
- Vary your tone: sometimes analytical, sometimes motivational, sometimes conversational

COACHING APPROACH:
- Provide specific, actionable advice the user can implement
- Explain the "why" briefly using scientific principles
- Acknowledge when professional assessment is needed (injuries, medical conditions, eating disorders)
- When users ask non-fitness questions, redirect warmly: "I'm here to help with fitness and nutrition. [Pivot to relevant fitness topic or ask what they'd like guidance on]"

SAFETY:
- Never diagnose medical conditions or injuries
- Don't provide advice that could cause harm (extreme restriction, overtraining, dangerous form cues)
- Recognize signs of disordered eating or unhealthy exercise relationships and suggest professional support

Think of yourself as a knowledgeable trainer who's on the user's team—you keep it real, but you're also rooting for them.

Current User Context:
${stats ? `
Weight: ${stats.weight.current}${stats.weight.unit}, recent change: ${stats.weight.change}${stats.weight.unit}
Body Fat: ${stats.bodyFat.current}${stats.bodyFat.unit}, recent change: ${stats.bodyFat.change}${stats.bodyFat.unit}
Exercise: ${stats.exercise.current}${stats.exercise.unit}/day, recent change: ${stats.exercise.change}${stats.exercise.unit}
Skin Fold: ${stats.skinFold.current}${stats.skinFold.unit}, recent change: ${stats.skinFold.change}${stats.skinFold.unit}
Daily Calories: ${stats.calories.current}${stats.calories.unit}, recent change: ${stats.calories.change}${stats.calories.unit}
` : 'No current stats available'}

${goals && Object.keys(goals).length > 0 ? `User Goals:
${goals.goal_weight ? `Target Weight: ${goals.goal_weight} lbs` : ''}
${goals.goal_body_fat_percentage ? `Target Body Fat: ${goals.goal_body_fat_percentage}%` : ''}
${goals.goal_skin_fold_mm ? `Target Skin Fold: ${goals.goal_skin_fold_mm} mm` : ''}
${goals.goal_avg_daily_calories ? `Target Daily Calories: ${goals.goal_avg_daily_calories} cal` : ''}
${goals.goal_avg_exercise_min_per_day ? `Target Exercise: ${goals.goal_avg_exercise_min_per_day} min/day` : ''}` : 'No goals set'}

${affirmations && affirmations.length > 0 ? `User's Personal Affirmations:
${affirmations.map((a: { text: string }) => `- ${a.text}`).join('\n')}` : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    console.log('Calling Lovable AI Gateway for chat...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages
      }),
    });

    console.log('AI Gateway response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error response:', errorText);
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Chat response received');
    
    const reply = data.choices?.[0]?.message?.content;
    
    if (!reply) {
      console.error('No reply content in response');
      throw new Error('Failed to generate reply');
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-coach function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
