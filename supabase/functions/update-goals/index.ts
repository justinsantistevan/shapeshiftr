import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation schema for fitness goals
const goalsSchema = z.object({
  goal_weight: z.number().min(50).max(400).nullable().optional(),
  goal_body_fat_percentage: z.number().min(3).max(60).nullable().optional(),
  goal_skin_fold_mm: z.number().min(2).max(70).nullable().optional(),
  goal_avg_daily_calories: z.number().int().min(800).max(5000).nullable().optional(),
  goal_avg_exercise_min_per_day: z.number().int().min(0).max(300).nullable().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const rawData = await req.json();
    console.log("Received goals data:", rawData);

    // Validate input
    const validationResult = goalsSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation errors:", validationResult.error.format());
      return new Response(
        JSON.stringify({ 
          error: "Invalid goal values. Please check your inputs.",
          details: validationResult.error.format()
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const goals = validationResult.data;
    console.log("Validated goals:", goals);

    // Upsert goals
    const { error: upsertError } = await supabase
      .from("user_goals")
      .upsert({
        user_id: user.id,
        ...goals,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (upsertError) {
      console.error("Database error:", upsertError);
      throw upsertError;
    }

    console.log("Goals updated successfully for user:", user.id);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in update-goals function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
