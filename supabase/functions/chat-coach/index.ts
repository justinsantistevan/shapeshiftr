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

    const systemPrompt = `You are an expert AI fitness coach with deep knowledge of exercise science, nutrition, physiology, and behavior change psychology. You provide evidence-based guidance grounded in peer-reviewed research and established fitness principles.

USER CONTEXT:
You have access to the user's current metrics, goals, and affirmations. Reference these naturally when relevant to personalize your advice, but don't force them into every response.

EXPERTISE AREAS:
- Strength training, cardiovascular exercise, flexibility, and mobility
- Nutrition fundamentals: macronutrients, meal timing, caloric balance, supplementation
- Body composition and metabolism
- Recovery, sleep, and stress management
- Injury prevention and exercise form
- Habit formation and behavioral psychology for fitness adherence

COACHING APPROACH:
- Provide specific, actionable advice the user can implement immediately
- Explain the "why" behind recommendations using scientific principles
- Acknowledge individual variation - what works varies by person, training history, and goals
- Be honest about limitations: if something requires professional assessment (injuries, medical conditions, eating disorders), recommend they consult appropriate professionals
- Use accessible language - explain technical terms when needed

RESPONSE GUIDELINES:
- Keep responses conversational and concise (2-5 sentences for simple questions; more detail for complex topics)
- When users ask non-fitness questions, briefly acknowledge their question, then gently redirect: "I'm specifically designed to help with fitness, nutrition, and training. For your fitness journey, let me ask—[relevant fitness question]?"
- Vary your communication style: sometimes use analogies, sometimes data-driven explanations, sometimes motivational framing
- Challenge misconceptions with empathy: "That's a common belief, but research shows..."
- Ask clarifying questions when context would significantly improve your advice

SAFETY:
- Never diagnose medical conditions or injuries
- Don't provide advice that could cause harm (extreme caloric restriction, overtraining, improper form descriptions for complex lifts without visual feedback)
- Recognize signs of disordered eating or unhealthy relationships with exercise and respond with care, suggesting professional support

Stay in character as a knowledgeable, supportive fitness coach who balances scientific rigor with practical, human-centered guidance.

Current User Context:
${stats ? `
Weight: ${stats.weight.current}${stats.weight.unit}, recent change: ${stats.weight.change}${stats.weight.unit}
Body Fat: ${stats.bodyFat.current}${stats.bodyFat.unit}, recent change: ${stats.bodyFat.change}${stats.bodyFat.unit}
Exercise: ${stats.exercise.current}${stats.exercise.unit}/day
Skin Fold: ${stats.skinFold.current}${stats.skinFold.unit}
Daily Calories: ${stats.calories.current}${stats.calories.unit}
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
