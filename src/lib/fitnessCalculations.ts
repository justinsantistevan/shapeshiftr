import { supabase } from "@/integrations/supabase/client";

export interface FitnessEntry {
  weight?: number;
  body_fat_percentage?: number;
  skin_fold_mm?: number;
  avg_daily_calories?: number;
  avg_exercise_min_per_day?: number;
  week_end_date: string;
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
  comparisonDate?: string; // week_end_date of the comparison entry
  comparisonDaysAgo?: number; // days between current and comparison entry
}

// Parse a YYYY-MM-DD string as a UTC date to avoid timezone issues
function parseUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
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
      .select('weight, body_fat_percentage, skin_fold_mm, avg_daily_calories, avg_exercise_min_per_day, week_end_date, created_at')
      .eq('user_id', user.id)
      .order('week_end_date', { ascending: false });

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
    
    // Find entry from exactly 4 weeks ago (28 days), using UTC-safe date math
    const currentEntryDate = parseUTCDate(currentEntry.week_end_date);
    const twentyEightDaysAgoDate = new Date(currentEntryDate.getTime());
    twentyEightDaysAgoDate.setUTCDate(twentyEightDaysAgoDate.getUTCDate() - 28); // 4 weeks = 28 days
    const twentyEightDaysAgoStr = twentyEightDaysAgoDate.toISOString().slice(0, 10);
    
    // Filter entries with actual data
    const entriesWithData = entries.filter(entry => 
      entry.weight !== null || 
      entry.body_fat_percentage !== null || 
      entry.skin_fold_mm !== null || 
      entry.avg_daily_calories !== null || 
      entry.avg_exercise_min_per_day !== null
    );
    
    // 1. STRICT PRIORITY: Look for entry exactly 28 days ago
    let previousEntry = entriesWithData.find(entry => 
      entry.week_end_date === twentyEightDaysAgoStr
    );
    
    // 2. Fallback: If exact 28-day entry not found, look for most recent entry at least 28 days ago
    // Since entries are ordered descending, the first match will be the closest to 28 days ago
    if (!previousEntry) {
      previousEntry = entriesWithData.find(entry => {
        const entryDate = parseUTCDate(entry.week_end_date);
        return entryDate.getTime() <= twentyEightDaysAgoDate.getTime();
      });
    }

    // Calculate comparison metadata
    let comparisonDate: string | undefined;
    let comparisonDaysAgo: number | undefined;
    
    if (previousEntry) {
      const previousEntryDate = parseUTCDate(previousEntry.week_end_date);
      comparisonDate = previousEntry.week_end_date;
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
  
  // Exact 4 weeks (28 days) should be labeled as "this month"
  if (weeks === 4) {
    return 'this month';
  }

  // For other week-based comparisons, be explicit about the timeframe
  if (weeks > 0 && weeks < 8) {
    return `last ${weeks} week${weeks > 1 ? 's' : ''}`;
  }

  // For longer timeframes, switch to months
  const months = Math.round(daysAgo / 30);
  return `last ${months} month${months > 1 ? 's' : ''}`;
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