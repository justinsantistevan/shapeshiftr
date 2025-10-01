import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FitnessStats } from "@/lib/fitnessCalculations";
import { UserGoals } from "@/lib/userGoals";
import { Button } from "./ui/button";

interface ProgressAnalysisProps {
  stats: FitnessStats | null;
  goals: UserGoals;
}

export const ProgressAnalysis = ({ stats, goals }: ProgressAnalysisProps) => {
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnalysis = async () => {
    if (!stats) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-progress', {
        body: { stats, goals }
      });

      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Error fetching progress analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Detailed error:', errorMessage);
      setAnalysis(`Unable to generate analysis: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [stats, goals]);

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Progress Analysis</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnalysis}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
            <div className="h-4 bg-muted animate-pulse rounded w-4/6" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {analysis || "Loading your personalized progress analysis..."}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
