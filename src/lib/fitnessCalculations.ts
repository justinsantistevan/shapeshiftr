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
  comparisonDate?: string; // week_start_date of the comparison entry
  comparisonDaysAgo?: number; // days between current and comparison entry
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
    
    // Find entry from approximately 4 weeks ago from the most recent entry date
    const currentEntryDate = new Date(currentEntry.week_start_date);
    const twentyEightDaysAgo = new Date(currentEntryDate);
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28); // 4 weeks = 28 days
    const thirtyFiveDaysAgo = new Date(currentEntryDate);
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35); // 5 weeks = 35 days
    
    // Filter entries with actual data
    const entriesWithData = entries.filter(entry => 
      entry.weight !== null || 
      entry.body_fat_percentage !== null || 
      entry.skin_fold_mm !== null || 
      entry.avg_daily_calories !== null || 
      entry.avg_exercise_min_per_day !== null
    );
    
    // First try to find entries in the ideal range: >= 28 days ago and < 35 days ago
    // This means entryDate > thirtyFiveDaysAgo (more recent than 35 days ago) 
    // AND entryDate <= twentyEightDaysAgo (at least 28 days ago)
    let previousEntry = entriesWithData.find(entry => {
      const entryDate = new Date(entry.week_start_date);
      return entryDate > thirtyFiveDaysAgo && entryDate <= twentyEightDaysAgo;
    });
    
    // If no entries in ideal range, fall back to most recent entry that is at least 28 days ago
    // Since entries are ordered descending, the first match will be the closest to 28 days ago
    if (!previousEntry) {
      previousEntry = entriesWithData.find(entry => {
        const entryDate = new Date(entry.week_start_date);
        return entryDate <= twentyEightDaysAgo;
      });
    }

    // Calculate comparison metadata
    let comparisonDate: string | undefined;
    let comparisonDaysAgo: number | undefined;
    
    if (previousEntry) {
      const previousEntryDate = new Date(previousEntry.week_start_date);
      comparisonDate = previousEntry.week_start_date;
      const daysDiff = Math.floor((currentEntryDate.getTime() - previousEntryDate.getTime()) / (1000 * 60 * 60 * 24));
      comparisonDaysAgo = daysDiff;
    }

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
      calories,
      comparisonDate,
      comparisonDaysAgo
    };
  } catch (error) {
    console.error('Error calculating fitness stats:', error);
    return null;
  }
}

// Determine if a trend is positive based on the metric type and direction
function isPositiveTrend(trend: FitnessTrend): boolean {
  if (trend.direction === 'neutral' || trend.change === null) return false;
  
  // Positive trends: weight down, body fat down, belly skinfold down, calories down, exercise up
  switch (trend.unit) {
    case 'lbs':      // weight - down is good
    case '%':        // body fat - down is good  
    case 'mm':       // skin fold - down is good
    case 'cal':      // calories - down is good
      return trend.direction === 'down';
    case 'min':      // exercise - up is good
      return trend.direction === 'up';
    default:
      return false;
  }
}

// Format the comparison timeframe for display
function formatComparisonTimeframe(daysAgo?: number): string {
  if (daysAgo === undefined) return 'this month';
  
  const weeks = Math.round(daysAgo / 7);
  
  if (weeks <= 4) {
    return 'in 4 weeks';
  } else if (weeks <= 8) {
    return `in ${weeks} weeks`;
  } else {
    const months = Math.round(daysAgo / 30);
    return `in ${months} month${months > 1 ? 's' : ''}`;
  }
}

// Format the change value for display
export function formatChange(
  trend: FitnessTrend,
  comparisonDaysAgo?: number
): { text: string; direction: 'up' | 'down' | 'neutral'; isPositive: boolean } {
  if (trend.change === null) return { text: '', direction: 'neutral', isPositive: false };
  
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
  
  const timeframe = formatComparisonTimeframe(comparisonDaysAgo);
  
  return {
    text: `${formattedChange} ${trend.unit} ${timeframe}`,
    direction: trend.direction,
    isPositive: isPositiveTrend(trend)
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