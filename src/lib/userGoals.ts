import { supabase } from "@/integrations/supabase/client";

export interface UserGoals {
  goal_weight?: number | null;
  goal_body_fat_percentage?: number | null;
  goal_skin_fold_mm?: number | null;
  goal_avg_daily_calories?: number | null;
  goal_avg_exercise_min_per_day?: number | null;
}

export const DEFAULT_GOALS: UserGoals = {
  goal_weight: 175,
  goal_body_fat_percentage: 15,
  goal_skin_fold_mm: 10,
  goal_avg_daily_calories: 2000,
  goal_avg_exercise_min_per_day: 60,
};

// Fetch user's goals from the database
export async function fetchUserGoals(): Promise<UserGoals> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data: goals, error } = await supabase
      .from('user_goals')
      .select('goal_weight, goal_body_fat_percentage, goal_skin_fold_mm, goal_avg_daily_calories, goal_avg_exercise_min_per_day')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If no goals found, return empty object (no reference lines)
      if (error.code === 'PGRST116') {
        return {};
      }
      throw error;
    }

    // Return only the goals that are actually set (not null)
    return {
      goal_weight: goals?.goal_weight ?? undefined,
      goal_body_fat_percentage: goals?.goal_body_fat_percentage ?? undefined,
      goal_skin_fold_mm: goals?.goal_skin_fold_mm ?? undefined,
      goal_avg_daily_calories: goals?.goal_avg_daily_calories ?? undefined,
      goal_avg_exercise_min_per_day: goals?.goal_avg_exercise_min_per_day ?? undefined,
    };
  } catch (error) {
    console.error('Error fetching user goals:', error);
    return {}; // Return empty object on error - no reference lines
  }
}