import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const AFFIRMATIONS = [
  "I can do hard things.",
  "I am disciplined.",
  "I have pain-free flexibility in my shoulder.",
  "My knee gets stronger every day.",
  "I enjoy working hard during workouts.",
  "I choose long term goals over short term gratification.",
  "If we overestimate what we can accomplish in a month, we underestimate what we can achieve in 6 months."
];

export function FitnessAffirmations() {
  return (
    <Card className="fitness-card p-6">
      <h3 className="text-xl font-semibold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        Daily Affirmations
      </h3>
      <div className="space-y-3">
        {AFFIRMATIONS.map((affirmation, index) => (
          <div 
            key={index} 
            className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {affirmation}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}