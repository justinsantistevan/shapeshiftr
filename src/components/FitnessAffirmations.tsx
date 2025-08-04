import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { fetchUserAffirmations, Affirmation } from "@/lib/affirmations";

export interface FitnessAffirmationsRef {
  refreshAffirmations: () => void;
}

interface FitnessAffirmationsProps {
  ref?: React.Ref<FitnessAffirmationsRef>;
}

export const FitnessAffirmations = forwardRef<FitnessAffirmationsRef, FitnessAffirmationsProps>((props, ref) => {
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
    return (
      <Card className="fitness-card p-6">
        <h3 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Daily Affirmations
        </h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
              <div className="h-5 w-5 bg-muted rounded-full animate-pulse flex-shrink-0 mt-0.5" />
              <div className="h-4 bg-muted rounded animate-pulse flex-1" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="fitness-card p-6">
      <h3 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        Daily Affirmations
      </h3>
      <div className="space-y-3">
        {affirmations.map((affirmation, index) => (
          <div 
            key={affirmation.id} 
            className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {affirmation.text}
            </p>
          </div>
        ))}
        {affirmations.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            No affirmations yet. Add some in your settings!
          </p>
        )}
      </div>
    </Card>
  );
});