import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const demoEmail = "demo-user@shapeshiftr.app";
    const demoPassword = "Password123";

    // Check if demo user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === demoEmail);

    let userId: string;

    if (existing) {
      userId = existing.id;
      console.log("Demo user already exists:", userId);
    } else {
      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: demoEmail,
          password: demoPassword,
          email_confirm: true,
        });
      if (createError) throw createError;
      userId = newUser.user.id;
      console.log("Created demo user:", userId);
    }

    // Clear any existing demo data for idempotency
    await supabase.from("weekly_fitness_entries").delete().eq("user_id", userId);
    await supabase.from("user_goals").delete().eq("user_id", userId);
    await supabase.from("user_affirmations").delete().eq("user_id", userId);
    await supabase.from("coach_chat_logs").delete().eq("user_id", userId);

    // Insert goals
    const { error: goalsError } = await supabase.from("user_goals").insert({
      user_id: userId,
      goal_weight: 158,
      goal_body_fat_percentage: 14,
      goal_skin_fold_mm: 18,
      goal_avg_daily_calories: 1800,
      goal_avg_exercise_min_per_day: 45,
    });
    if (goalsError) throw goalsError;

    // Generate 12 weeks of fitness entries (Sundays going back from today)
    const today = new Date();
    const entries = [];
    const notes = [
      "Solid week, hit all my workouts. Feeling stronger.",
      "Traveled for work, ate out more than usual. Still got 3 workouts in.",
      "Great discipline this week. Meal prepped on Sunday and stuck to it.",
      "Knee was a bit sore, took an extra rest day. Focused on upper body.",
      "Holiday weekend, indulged a bit but got back on track Monday.",
      "Best week yet! New PR on deadlift. Sleep has been great.",
      "Stressful week at work, stress-ate a couple evenings. Still trained 4x.",
      "Dialed in nutrition this week. Feeling leaner in the mirror.",
      "Missed two workouts due to schedule. Made up with longer weekend sessions.",
      "Consistent week. Nothing flashy, just stuck to the plan.",
      "Pushed cardio harder this week. Added morning walks.",
      "Feeling the cumulative progress. Clothes fitting noticeably better.",
    ];

    // Data arc: week 0 is oldest (12 weeks ago), week 11 is most recent
    const weightArc =   [172.4, 171.0, 170.2, 169.8, 170.5, 168.3, 167.1, 165.8, 164.2, 163.0, 161.5, 160.8];
    const bfArc =       [18.5,  18.2,  17.8,  17.5,  17.8,  17.1,  16.7,  16.3,  15.9,  15.5,  15.0,  14.5];
    const sfArc =       [25,    24,    24,    23,    24,    22,    22,    21,    20,    20,    19,    19];
    const calArc =      [2280,  2150,  1950,  1880,  2300,  1850,  1790,  1820,  2050,  1810,  1780,  1750];
    const exerciseArc = [32,    35,    40,    42,    30,    48,    45,    50,    38,    52,    55,    58];

    for (let i = 0; i < 12; i++) {
      // Calculate the Sunday for this week (going back from most recent Sunday)
      const daysBack = (11 - i) * 7;
      const d = new Date(today);
      // Find most recent Sunday
      d.setDate(d.getDate() - d.getDay());
      // Go back the right number of days
      d.setDate(d.getDate() - daysBack);
      const weekEndDate = d.toISOString().split("T")[0];

      entries.push({
        user_id: userId,
        week_end_date: weekEndDate,
        weight: weightArc[i],
        body_fat_percentage: bfArc[i],
        skin_fold_mm: sfArc[i],
        avg_daily_calories: calArc[i],
        avg_exercise_min_per_day: exerciseArc[i],
        notes: notes[i],
      });
    }

    const { error: entriesError } = await supabase
      .from("weekly_fitness_entries")
      .insert(entries);
    if (entriesError) throw entriesError;

    // Insert affirmations
    const affirmations = [
      "I am building a body I'm proud of, one day at a time.",
      "Discipline is choosing what I want most over what I want now.",
      "I trust the process — the results will follow.",
      "Every workout makes me stronger than yesterday.",
      "I fuel my body with intention and purpose.",
      "Progress over perfection, always.",
      "I show up for myself even when it's hard.",
    ];

    const affirmationRows = affirmations.map((text, i) => ({
      user_id: userId,
      text,
      display_order: i,
    }));

    const { error: affError } = await supabase
      .from("user_affirmations")
      .insert(affirmationRows);
    if (affError) throw affError;

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: `Demo user seeded with ${entries.length} weeks of data, goals, and ${affirmations.length} affirmations.`,
        credentials: { email: demoEmail, password: demoPassword },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
