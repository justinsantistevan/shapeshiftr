import { supabase } from "@/integrations/supabase/client";

export interface FitnessEntry {
  weight?: number;
  body_fat_percentage?: number;
  skin_fold_mm?: number;
  avg_daily_calories?: number;
  avg_exercise_min_per_day?: number;
  week_start_date: string;
  created_at: string;
}

export interface FitnessTrend {
  current: number | null;
  change: number | null;
  direction: 'up' | 'down' | 'neutral';
  unit: string;
}

export interface FitnessStats {
  weight: FitnessTrend;
  bodyFat: FitnessTrend;
  exercise: FitnessTrend;
  skinFold: FitnessTrend;
  calories: FitnessTrend;
}

// Calculate the trend between two values
function calculateTrend(current: number | null, previous: number | null, unit: string): FitnessTrend {
  if (current === null) {
    return { current: null, change: null, direction: 'neutral', unit };
  }
  
  if (previous === null) {
    return { current, change: null, direction: 'neutral', unit };
  }
  
  const change = current - previous;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  
  return { current, change, direction, unit };
}

// Fetch user's fitness data and calculate monthly trends
export async function calculateFitnessStats(): Promise<FitnessStats | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Fetch user's fitness entries ordered by date
    const { data: entries, error } = await supabase
      .from('weekly_fitness_entries')
      .select('weight, body_fat_percentage, skin_fold_mm, avg_daily_calories, avg_exercise_min_per_day, week_start_date, created_at')
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: false });

    if (error) throw error;
    if (!entries || entries.length === 0) return null;

    // Get most recent entry with actual data (current values)
    const currentEntry = entries.find(entry => 
      entry.weight !== null || 
      entry.body_fat_percentage !== null || 
      entry.skin_fold_mm !== null || 
      entry.avg_daily_calories !== null || 
      entry.avg_exercise_min_per_day !== null
    );
    
    if (!currentEntry) return null;
    
    // Find entry from approximately 4 weeks ago for monthly comparison
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28); // 4 weeks = 28 days
    
    const previousEntry = entries.find(entry => {
      const entryDate = new Date(entry.week_start_date);
      return entryDate <= fourWeeksAgo && (
        entry.weight !== null || 
        entry.body_fat_percentage !== null || 
        entry.skin_fold_mm !== null || 
        entry.avg_daily_calories !== null || 
        entry.avg_exercise_min_per_day !== null
      );
    });

    // Calculate trends for each metric
    const weight = calculateTrend(currentEntry.weight, previousEntry?.weight || null, 'lbs');
    const bodyFat = calculateTrend(currentEntry.body_fat_percentage, previousEntry?.body_fat_percentage || null, '%');
    const exercise = calculateTrend(currentEntry.avg_exercise_min_per_day, previousEntry?.avg_exercise_min_per_day || null, 'min');
    const skinFold = calculateTrend(currentEntry.skin_fold_mm, previousEntry?.skin_fold_mm || null, 'mm');
    const calories = calculateTrend(currentEntry.avg_daily_calories, previousEntry?.avg_daily_calories || null, 'cal');

    return {
      weight,
      bodyFat,
      exercise,
      skinFold,
      calories
    };
  } catch (error) {
    console.error('Error calculating fitness stats:', error);
    return null;
  }
}

// Format the change value for display
export function formatChange(trend: FitnessTrend): { text: string; direction: 'up' | 'down' | 'neutral' } {
  if (trend.change === null) return { text: '', direction: 'neutral' };
  
  const absChange = Math.abs(trend.change);
  
  let formattedChange: string;
  
  // Format based on unit type
  switch (trend.unit) {
    case 'lbs':
      formattedChange = absChange.toFixed(1);
      break;
    case '%':
      formattedChange = absChange.toFixed(1);
      break;
    case 'min':
    case 'mm':
      formattedChange = Math.round(absChange).toString();
      break;
    case 'cal':
      formattedChange = Math.round(absChange).toString();
      break;
    default:
      formattedChange = absChange.toString();
  }
  
  return {
    text: `${formattedChange} ${trend.unit} this month`,
    direction: trend.direction
  };
}

// Format the current value for display
export function formatCurrentValue(trend: FitnessTrend): string {
  if (trend.current === null) return '--';
  
  switch (trend.unit) {
    case 'lbs':
      return trend.current.toFixed(1);
    case '%':
      return `${trend.current.toFixed(1)}%`;
    case 'min':
      return Math.round(trend.current).toString();
    case 'mm':
      return `${Math.round(trend.current)}mm`;
    case 'cal':
      return trend.current.toLocaleString();
    default:
      return trend.current.toString();
  }
}