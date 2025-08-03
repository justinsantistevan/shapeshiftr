import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GoalsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalsForm({ open, onOpenChange }: GoalsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    goal_weight: "",
    goal_body_fat_percentage: "",
    goal_skin_fold_mm: "",
    goal_avg_daily_calories: "",
    goal_avg_exercise_min_per_day: ""
  });
  const { toast } = useToast();

  // Load existing goals when dialog opens
  useEffect(() => {
    if (open) {
      loadGoals();
    }
  }, [open]);

  const loadGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading goals:', error);
        return;
      }

      if (data) {
        setFormData({
          goal_weight: data.goal_weight?.toString() || "",
          goal_body_fat_percentage: data.goal_body_fat_percentage?.toString() || "",
          goal_skin_fold_mm: data.goal_skin_fold_mm?.toString() || "",
          goal_avg_daily_calories: data.goal_avg_daily_calories?.toString() || "",
          goal_avg_exercise_min_per_day: data.goal_avg_exercise_min_per_day?.toString() || ""
        });
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to set goals.",
          variant: "destructive",
        });
        return;
      }

      // Prepare data for insertion, converting strings to numbers where needed
      const goalsData = {
        user_id: user.id,
        goal_weight: formData.goal_weight ? parseFloat(formData.goal_weight) : null,
        goal_body_fat_percentage: formData.goal_body_fat_percentage ? parseFloat(formData.goal_body_fat_percentage) : null,
        goal_skin_fold_mm: formData.goal_skin_fold_mm ? parseFloat(formData.goal_skin_fold_mm) : null,
        goal_avg_daily_calories: formData.goal_avg_daily_calories ? parseInt(formData.goal_avg_daily_calories) : null,
        goal_avg_exercise_min_per_day: formData.goal_avg_exercise_min_per_day ? parseInt(formData.goal_avg_exercise_min_per_day) : null
      };

      const { error } = await supabase
        .from('user_goals')
        .upsert(goalsData, { 
          onConflict: 'user_id' 
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success!",
          description: "Your fitness goals have been saved.",
        });
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Your Fitness Goals</DialogTitle>
          <DialogDescription>
            Define your target fitness metrics. These goals will persist across all your weekly entries.
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal_weight">Goal Weight (lbs)</Label>
                  <Input
                    id="goal_weight"
                    type="number"
                    step="0.1"
                    placeholder="145.0"
                    value={formData.goal_weight}
                    onChange={(e) => handleInputChange('goal_weight', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal_body_fat">Goal Body Fat (%)</Label>
                  <Input
                    id="goal_body_fat"
                    type="number"
                    step="0.1"
                    placeholder="12.0"
                    value={formData.goal_body_fat_percentage}
                    onChange={(e) => handleInputChange('goal_body_fat_percentage', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal_skin_fold">Goal Skin Fold (mm)</Label>
                <Input
                  id="goal_skin_fold"
                  type="number"
                  step="0.1"
                  placeholder="7.0"
                  value={formData.goal_skin_fold_mm}
                  onChange={(e) => handleInputChange('goal_skin_fold_mm', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal_avg_daily_calories">Goal Daily Calories</Label>
                  <Input
                    id="goal_avg_daily_calories"
                    type="number"
                    placeholder="1800"
                    value={formData.goal_avg_daily_calories}
                    onChange={(e) => handleInputChange('goal_avg_daily_calories', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal_avg_exercise_min">Goal Exercise Min/Day</Label>
                  <Input
                    id="goal_avg_exercise_min"
                    type="number"
                    placeholder="45"
                    value={formData.goal_avg_exercise_min_per_day}
                    onChange={(e) => handleInputChange('goal_avg_exercise_min_per_day', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Goals"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}