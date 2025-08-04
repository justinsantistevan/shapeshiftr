import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// Mock data for demonstration
const mockData = [
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
  avgCalories: { label: "Avg Calories/Week", color: "#f59e0b", goal: 2000 },
  avgExercise: { label: "Avg Exercise Min/Day", color: "#10b981", goal: 60 },
};

export function MetricsChart() {
  const [primaryMetric, setPrimaryMetric] = useState<string>("weight");
  const [secondaryMetric, setSecondaryMetric] = useState<string>("none");

  return (
    <Card className="fitness-card col-span-2">
      <CardHeader>
        <CardTitle className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Progress Metrics
        </CardTitle>
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
      <CardContent>
        <div className="h-80 chart-container p-4 rounded-lg">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="week" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
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
                  fontSize={12}
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
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Dashed lines represent your goals for each metric
        </div>
      </CardContent>
    </Card>
  );
}