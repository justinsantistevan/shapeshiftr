import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddDataFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddDataForm({ open, onOpenChange, onSuccess }: AddDataFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Today's date
    weight: "",
    body_fat_percentage: "",
    muscle_mass: "",
    workout_duration: "",
    calories_burned: "",
    notes: ""
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to add data.",
          variant: "destructive",
        });
        return;
      }

      // Prepare data for insertion, converting strings to numbers where needed
      const insertData = {
        user_id: user.id,
        date: formData.date,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        body_fat_percentage: formData.body_fat_percentage ? parseFloat(formData.body_fat_percentage) : null,
        muscle_mass: formData.muscle_mass ? parseFloat(formData.muscle_mass) : null,
        workout_duration: formData.workout_duration ? parseInt(formData.workout_duration) : null,
        calories_burned: formData.calories_burned ? parseInt(formData.calories_burned) : null,
        notes: formData.notes || null
      };

      const { error } = await supabase
        .from('fitness_entries')
        .upsert(insertData, { 
          onConflict: 'user_id,date' 
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
          description: "Fitness data saved successfully.",
        });
        
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          weight: "",
          body_fat_percentage: "",
          muscle_mass: "",
          workout_duration: "",
          calories_burned: "",
          notes: ""
        });
        
        onSuccess();
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
          <DialogTitle>Add Fitness Data</DialogTitle>
          <DialogDescription>
            Track your fitness metrics for today or a specific date.
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (lbs)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    placeholder="150.5"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body_fat">Body Fat (%)</Label>
                  <Input
                    id="body_fat"
                    type="number"
                    step="0.1"
                    placeholder="15.5"
                    value={formData.body_fat_percentage}
                    onChange={(e) => handleInputChange('body_fat_percentage', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="muscle_mass">Muscle Mass (lbs)</Label>
                <Input
                  id="muscle_mass"
                  type="number"
                  step="0.1"
                  placeholder="120.0"
                  value={formData.muscle_mass}
                  onChange={(e) => handleInputChange('muscle_mass', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workout_duration">Workout (min)</Label>
                  <Input
                    id="workout_duration"
                    type="number"
                    placeholder="60"
                    value={formData.workout_duration}
                    onChange={(e) => handleInputChange('workout_duration', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calories_burned">Calories Burned</Label>
                  <Input
                    id="calories_burned"
                    type="number"
                    placeholder="300"
                    value={formData.calories_burned}
                    onChange={(e) => handleInputChange('calories_burned', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="How did you feel today? Any observations?"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="min-h-[80px]"
                />
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
                  {isLoading ? "Saving..." : "Save Data"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}