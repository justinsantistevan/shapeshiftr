import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ArrowLeft, ArrowRight, BarChart3, Table as TableIcon, Scale, Activity, Ruler, Zap, UtensilsCrossed } from "lucide-react";
import { fetchUserGoals, UserGoals, DEFAULT_GOALS } from "@/lib/userGoals";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface WeeklyEntry {
  week: string;
  weight: number | null;
  bodyFat: number | null;
  skinFold: number | null;
  avgCalories: number | null;
  avgExercise: number | null;
}

const METRICS = {
  weight: { label: "Weight", unit: "lbs", color: "hsl(var(--primary))", goalKey: "goal_weight" as keyof UserGoals, icon: Scale },
  bodyFat: { label: "Body Fat", unit: "%", color: "hsl(var(--secondary))", goalKey: "goal_body_fat_percentage" as keyof UserGoals, icon: Activity },
  skinFold: { label: "Belly Skinfold", unit: "mm", color: "hsl(var(--destructive))", goalKey: "goal_skin_fold_mm" as keyof UserGoals, icon: Ruler },
  avgExercise: { label: "Daily Exercise", unit: "min", color: "hsl(150 80% 40%)", goalKey: "goal_avg_exercise_min_per_day" as keyof UserGoals, icon: Zap },
  avgCalories: { label: "Daily Calories", unit: "cal", color: "hsl(270 50% 60%)", goalKey: "goal_avg_daily_calories" as keyof UserGoals, icon: UtensilsCrossed },
};

export interface MetricsChartRef {
  refreshGoals: () => void;
}

interface MetricsChartProps {
  ref?: React.Ref<MetricsChartRef>;
}

export const MetricsChart = forwardRef<MetricsChartRef, MetricsChartProps>((props, ref) => {
  const [primaryMetric, setPrimaryMetric] = useState<string>("weight");
  const [secondaryMetric, setSecondaryMetric] = useState<string>("bodyFat");
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [userGoals, setUserGoals] = useState<UserGoals>({});
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [fitnessData, setFitnessData] = useState<WeeklyEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  
  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Load user goals
  const loadGoals = async () => {
    setIsLoadingGoals(true);
    const goals = await fetchUserGoals();
    setUserGoals(goals);
    setIsLoadingGoals(false);
  };

  // Load fitness data from Supabase
  const loadFitnessData = async () => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('weekly_fitness_entries')
        .select('*')
        .order('week_start_date', { ascending: true });

      if (error) {
        console.error('Error fetching fitness data:', error);
        setFitnessData([]);
      } else {
        const formattedData: WeeklyEntry[] = data.map(entry => {
          // Ensure we're showing the Sunday date (week start date)
          // Parse the date as local date to avoid timezone issues
          const [year, month, day] = entry.week_start_date.split('-').map(Number);
          const weekStartDate = new Date(year, month - 1, day);
          return {
            week: format(weekStartDate, 'M/d/yy'),
            weight: entry.weight,
            bodyFat: entry.body_fat_percentage,
            skinFold: entry.skin_fold_mm,
            avgCalories: entry.avg_daily_calories,
            avgExercise: entry.avg_exercise_min_per_day,
          };
        });
        setFitnessData(formattedData);
        // Set initial week index to show the last 4 weeks
        setCurrentWeekIndex(Math.max(0, formattedData.length - 4));
      }
    } catch (error) {
      console.error('Error loading fitness data:', error);
      setFitnessData([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadGoals();
    loadFitnessData();
  }, []);

  // Expose refresh function through ref
  useImperativeHandle(ref, () => ({
    refreshGoals: () => {
      loadGoals();
      loadFitnessData();
    }
  }));
  
  const WEEKS_TO_SHOW = 4;
  
  // Get the current data slice to display
  const currentData = fitnessData.slice(currentWeekIndex, currentWeekIndex + WEEKS_TO_SHOW);
  
  const canScrollPrev = currentWeekIndex > 0;
  const canScrollNext = currentWeekIndex < fitnessData.length - WEEKS_TO_SHOW;
  
  const scrollPrev = () => {
    if (canScrollPrev) {
      setCurrentWeekIndex(prev => Math.max(0, prev - 1));
    }
  };
  
  const scrollNext = () => {
    if (canScrollNext) {
      setCurrentWeekIndex(prev => Math.min(fitnessData.length - WEEKS_TO_SHOW, prev + 1));
    }
  };
  
  // Helper function to get goal value for a metric
  const getGoalValue = (metricKey: string): number | null => {
    const metric = METRICS[metricKey as keyof typeof METRICS];
    if (!metric) return null;
    return userGoals[metric.goalKey] ?? null;
  };

  // Font sizes based on screen size
  const xAxisFontSize = isMobile ? 10 : 12; // Larger on PC/tablet
  const yAxisFontSize = 10; // Same for axis values
  const yLabelFontSize = isMobile ? 10 : 12; // Smaller on mobile for y-axis labels

  // Helper to format table cell values
  const formatTableValue = (value: number | null, metricKey: string): string => {
    if (value === null) return '--';
    const metric = METRICS[metricKey as keyof typeof METRICS];
    if (!metric) return '--';
    
    switch (metric.unit) {
      case 'lbs':
      case '%':
        return value.toFixed(1);
      case 'min':
      case 'mm':
        return Math.round(value).toString();
      case 'cal':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  return (
    <Card className="fitness-card col-span-2 h-full min-h-[400px] md:min-h-0 flex flex-col rounded-xl">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-primary leading-normal">
            Progress Metrics
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
              className="h-8 px-3"
            >
              {viewMode === 'chart' ? (
                <>
                  <TableIcon className="h-4 w-4 mr-2" />
                  Table
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Chart
                </>
              )}
            </Button>
            {viewMode === 'chart' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollPrev}
                  disabled={!canScrollPrev}
                  className="h-8 w-8 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Previous weeks</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollNext}
                  disabled={!canScrollNext}
                  className="h-8 w-8 p-0"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span className="sr-only">Next weeks</span>
                </Button>
              </>
            )}
          </div>
        </div>
        {viewMode === 'chart' && (
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Primary Metric</label>
              <Select value={primaryMetric} onValueChange={(value) => {
                setPrimaryMetric(value);
                // If secondary metric is the same as the new primary, reset it to "none"
                if (secondaryMetric === value) {
                  setSecondaryMetric("none");
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METRICS).map(([key, metric]) => (
                    <SelectItem key={key} value={key}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Secondary Metric</label>
              <Select value={secondaryMetric} onValueChange={setSecondaryMetric}>
                <SelectTrigger>
                  <SelectValue placeholder="Select secondary metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {Object.entries(METRICS)
                    .filter(([key]) => key !== primaryMetric)
                    .map(([key, metric]) => (
                      <SelectItem key={key} value={key}>
                        {metric.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {isLoadingData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : fitnessData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-muted-foreground mb-4">
                Start tracking your progress by adding your first weekly entry.
              </p>
              <Button 
                onClick={() => {
                  // This will be handled by the parent Dashboard component
                  const event = new CustomEvent('openAddData');
                  window.dispatchEvent(event);
                }}
                className="w-full sm:w-auto"
              >
                Add Data
              </Button>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0">
              <ScrollArea className="h-full w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px] sticky top-0 bg-background z-10">Week</TableHead>
                      {Object.entries(METRICS).map(([key, metric]) => {
                        const Icon = metric.icon;
                        return (
                          <TableHead key={key} className="text-center sticky top-0 bg-background z-10 w-[140px]">
                            <div className="flex items-center justify-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{metric.label}</span>
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...fitnessData].reverse().map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{entry.week}</TableCell>
                        <TableCell className="text-center">
                          {formatTableValue(entry.weight, 'weight')}
                          {entry.weight !== null && ' lbs'}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatTableValue(entry.bodyFat, 'bodyFat')}
                          {entry.bodyFat !== null && '%'}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatTableValue(entry.skinFold, 'skinFold')}
                          {entry.skinFold !== null && ' mm'}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatTableValue(entry.avgExercise, 'avgExercise')}
                          {entry.avgExercise !== null && ' min'}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatTableValue(entry.avgCalories, 'avgCalories')}
                          {entry.avgCalories !== null && ' cal'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 chart-container p-4 rounded-lg">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="week" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={xAxisFontSize}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={yAxisFontSize}
                label={{ 
                  value: METRICS[primaryMetric as keyof typeof METRICS]?.label, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { 
                    textAnchor: 'middle', 
                    fill: 'hsl(var(--muted-foreground))', 
                    fontSize: yLabelFontSize 
                  }
                }}
              />
              {secondaryMetric && secondaryMetric !== "none" && (
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={yAxisFontSize}
                  label={{ 
                    value: METRICS[secondaryMetric as keyof typeof METRICS]?.label, 
                    angle: 90, 
                    position: 'insideRight',
                    style: { 
                      textAnchor: 'middle', 
                      fill: 'hsl(var(--muted-foreground))', 
                      fontSize: yLabelFontSize 
                    }
                  }}
                />
              )}
              <Tooltip 
                contentStyle={{
                  backgroundColor: document.documentElement.classList.contains('dark') ? "#1f2937" : "#f8fafc",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }}
                labelStyle={{
                  color: "hsl(var(--foreground))"
                }}
                formatter={(value, name) => {
                  const metric = METRICS[name as keyof typeof METRICS];
                  const numValue = typeof value === 'number' ? value : parseFloat(value as string);
                  
                  let formattedValue: string;
                  switch (metric?.unit) {
                    case 'lbs':
                    case '%':
                      formattedValue = numValue.toFixed(1);
                      break;
                    case 'min':
                    case 'mm':
                      formattedValue = Math.round(numValue).toString();
                      break;
                    case 'cal':
                      formattedValue = numValue.toLocaleString();
                      break;
                    default:
                      formattedValue = numValue.toString();
                  }
                  
                  return [formattedValue, `${metric?.label || name} (${metric?.unit})`];
                }}
              />
              <Bar 
                yAxisId="left"
                dataKey={primaryMetric} 
                fill={METRICS[primaryMetric as keyof typeof METRICS]?.color}
                radius={[4, 4, 0, 0]}
                className=""
              />
              {secondaryMetric && secondaryMetric !== "none" && (
                <Bar 
                  yAxisId="right"
                  dataKey={secondaryMetric} 
                  fill={METRICS[secondaryMetric as keyof typeof METRICS]?.color}
                  radius={[4, 4, 0, 0]}
                  className=""
                />
              )}
              {getGoalValue(primaryMetric) && (
                <ReferenceLine 
                  yAxisId="left"
                  y={getGoalValue(primaryMetric)} 
                  stroke={METRICS[primaryMetric as keyof typeof METRICS]?.color} 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              {secondaryMetric && secondaryMetric !== "none" && getGoalValue(secondaryMetric) && (
                <ReferenceLine 
                  yAxisId="right"
                  y={getGoalValue(secondaryMetric)} 
                  stroke={METRICS[secondaryMetric as keyof typeof METRICS]?.color} 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
          </div>
        )}
        {fitnessData.length > 0 && viewMode === 'chart' && (
          <div className="mt-4 text-xs text-muted-foreground text-center flex-shrink-0">
            Dashed lines represent your goals for each metric
          </div>
        )}
      </CardContent>
    </Card>
  );
});