import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { fetchUserAffirmations, Affirmation } from "@/lib/affirmations";
export interface FitnessAffirmationsRef {
  refreshAffirmations: () => void;
}
interface FitnessAffirmationsProps {
  onOpenAffirmations?: () => void;
}
export const FitnessAffirmations = forwardRef<FitnessAffirmationsRef, FitnessAffirmationsProps>(({
  onOpenAffirmations
}, ref) => {
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadAffirmations = async () => {
    setIsLoading(true);
    const data = await fetchUserAffirmations();
    setAffirmations(data);
    setIsLoading(false);
  };
  useImperativeHandle(ref, () => ({
    refreshAffirmations: loadAffirmations
  }));
  useEffect(() => {
    loadAffirmations();
  }, []);
  if (isLoading) {
    return <div className="fitness-card p-6">
        <h3 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Fitness Affirmations
        </h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
              <div className="h-5 w-5 bg-muted rounded-full animate-pulse flex-shrink-0 mt-0.5" />
              <div className="h-4 bg-muted rounded animate-pulse flex-1" />
            </div>)}
        </div>
      </div>;
  }
  return <div className="fitness-card p-6">
      <h3 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        Fitness Affirmations
      </h3>
      {affirmations.length === 0 ? <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Add your own affirmations to see them here!</p>
          <Button onClick={onOpenAffirmations} className="w-full sm:w-auto">
            Add Affirmations
          </Button>
        </div> : <div className="space-y-3">
          {affirmations.map((affirmation, index) => <div key={affirmation.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-slide-up" style={{
        animationDelay: `${index * 0.1}s`
      }}>
              <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {affirmation.text}
              </p>
            </div>)}
        </div>}
    </div>;
});