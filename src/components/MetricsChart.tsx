import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ArrowLeft, ArrowRight } from "lucide-react";

// Mock data for demonstration - expanded to show more weeks for navigation
const allMockData = [
  { week: "Jun 15", weight: 185.2, bodyFat: 19.8, skinFold: 18, avgCalories: 2350, avgExercise: 35 },
  { week: "Jun 22", weight: 184.5, bodyFat: 19.5, skinFold: 17, avgCalories: 2300, avgExercise: 38 },
  { week: "Jun 29", weight: 183.8, bodyFat: 19.2, skinFold: 16, avgCalories: 2280, avgExercise: 40 },
  { week: "Jul 6", weight: 182.9, bodyFat: 18.9, skinFold: 16, avgCalories: 2250, avgExercise: 42 },
  { week: "Jul 13", weight: 182.1, bodyFat: 18.6, skinFold: 15, avgCalories: 2230, avgExercise: 43 },
  { week: "Jul 20", weight: 181.3, bodyFat: 18.4, skinFold: 15, avgCalories: 2220, avgExercise: 44 },
  { week: "Jul 27", weight: 180.5, bodyFat: 18.2, skinFold: 15, avgCalories: 2200, avgExercise: 45 },
  { week: "Aug 3", weight: 179.8, bodyFat: 17.9, skinFold: 14, avgCalories: 2150, avgExercise: 50 },
  { week: "Aug 10", weight: 179.2, bodyFat: 17.6, skinFold: 14, avgCalories: 2100, avgExercise: 55 },
  { week: "Aug 17", weight: 178.7, bodyFat: 17.3, skinFold: 13, avgCalories: 2080, avgExercise: 52 },
  { week: "Aug 24", weight: 178.1, bodyFat: 17.0, skinFold: 13, avgCalories: 2050, avgExercise: 58 },
];

const METRICS = {
  weight: { label: "Weight (lbs)", color: "#3b82f6", goal: 175 },
  bodyFat: { label: "Body Fat %", color: "#8b5cf6", goal: 15 },
  skinFold: { label: "Skin Fold (mm)", color: "#ef4444", goal: 10 },
  avgCalories: { label: "Avg Daily Calories", color: "#f59e0b", goal: 2000 },
  avgExercise: { label: "Avg Daily Exercise (min)", color: "#10b981", goal: 60 },
};

export function MetricsChart() {
  const [primaryMetric, setPrimaryMetric] = useState<string>("weight");
  const [secondaryMetric, setSecondaryMetric] = useState<string>("none");
  const [currentWeekIndex, setCurrentWeekIndex] = useState(allMockData.length - 4); // Start showing the last 4 weeks
  
  const WEEKS_TO_SHOW = 4;
  
  // Get the current data slice to display
  const currentData = allMockData.slice(currentWeekIndex, currentWeekIndex + WEEKS_TO_SHOW);
  
  const canScrollPrev = currentWeekIndex > 0;
  const canScrollNext = currentWeekIndex < allMockData.length - WEEKS_TO_SHOW;
  
  const scrollPrev = () => {
    if (canScrollPrev) {
      setCurrentWeekIndex(prev => Math.max(0, prev - 1));
    }
  };
  
  const scrollNext = () => {
    if (canScrollNext) {
      setCurrentWeekIndex(prev => Math.min(allMockData.length - WEEKS_TO_SHOW, prev + 1));
    }
  };

  return (
    <Card className="fitness-card col-span-2 h-full min-h-[400px] md:min-h-0 flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Progress Metrics
          </CardTitle>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <label className="text-sm font-medium">Primary Metric</label>
            <Select value={primaryMetric} onValueChange={setPrimaryMetric}>
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
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 min-h-0 chart-container p-4 rounded-lg">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="week" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                label={{ 
                  value: METRICS[primaryMetric as keyof typeof METRICS]?.label, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                }}
              />
              {secondaryMetric && secondaryMetric !== "none" && (
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  label={{ 
                    value: METRICS[secondaryMetric as keyof typeof METRICS]?.label, 
                    angle: 90, 
                    position: 'insideRight',
                    style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                  }}
                />
              )}
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }}
                labelStyle={{
                  color: "hsl(var(--foreground))"
                }}
                formatter={(value, name) => {
                  const metric = METRICS[name as keyof typeof METRICS];
                  return [value, metric?.label || name];
                }}
              />
              <Bar 
                yAxisId="left"
                dataKey={primaryMetric} 
                fill={METRICS[primaryMetric as keyof typeof METRICS]?.color}
                radius={[4, 4, 0, 0]}
                className="animate-chart-bar"
              />
              {secondaryMetric && secondaryMetric !== "none" && (
                <Bar 
                  yAxisId="right"
                  dataKey={secondaryMetric} 
                  fill={METRICS[secondaryMetric as keyof typeof METRICS]?.color}
                  radius={[4, 4, 0, 0]}
                  className="animate-chart-bar"
                />
              )}
              <ReferenceLine 
                yAxisId="left"
                y={METRICS[primaryMetric as keyof typeof METRICS]?.goal} 
                stroke={METRICS[primaryMetric as keyof typeof METRICS]?.color} 
                strokeDasharray="5 5"
                strokeWidth={2}
              />
              {secondaryMetric && secondaryMetric !== "none" && (
                <ReferenceLine 
                  yAxisId="right"
                  y={METRICS[secondaryMetric as keyof typeof METRICS]?.goal} 
                  stroke={METRICS[secondaryMetric as keyof typeof METRICS]?.color} 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-xs text-muted-foreground text-center flex-shrink-0">
          Dashed lines represent your goals for each metric
        </div>
      </CardContent>
    </Card>
  );
}