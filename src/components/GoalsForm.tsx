import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const goalsSchema = z.object({
  goal_weight: z
    .string()
    .optional()
    .refine((val) => !val || val === "" || (parseFloat(val) >= 50 && parseFloat(val) <= 400), {
      message: "Goal weight must be between 50 and 400 lbs",
    }),
  goal_body_fat_percentage: z
    .string()
    .optional()
    .refine((val) => !val || val === "" || (parseFloat(val) >= 3 && parseFloat(val) <= 60), {
      message: "Goal body fat must be between 3% and 60%",
    }),
  goal_skin_fold_mm: z
    .string()
    .optional()
    .refine((val) => !val || val === "" || (parseFloat(val) >= 2 && parseFloat(val) <= 70), {
      message: "Goal skinfold must be between 2 and 70 mm",
    }),
  goal_avg_daily_calories: z
    .string()
    .optional()
    .refine((val) => !val || val === "" || (parseInt(val) >= 800 && parseInt(val) <= 5000), {
      message: "Goal calories must be between 800 and 5000",
    }),
  goal_avg_exercise_min_per_day: z
    .string()
    .optional()
    .refine((val) => !val || val === "" || (parseInt(val) >= 0 && parseInt(val) <= 300), {
      message: "Goal exercise must be between 0 and 300 minutes",
    }),
});

type GoalsFormValues = z.infer<typeof goalsSchema>;
interface GoalsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoalsUpdated?: () => void;
}
export function GoalsForm({
  open,
  onOpenChange,
  onGoalsUpdated
}: GoalsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [shouldWiggle, setShouldWiggle] = useState(false);
  const { toast } = useToast();

  const form = useForm<GoalsFormValues>({
    resolver: zodResolver(goalsSchema),
    mode: "onChange",
    defaultValues: {
      goal_weight: "",
      goal_body_fat_percentage: "",
      goal_skin_fold_mm: "",
      goal_avg_daily_calories: "",
      goal_avg_exercise_min_per_day: ""
    }
  });

  // Load existing goals when dialog opens
  useEffect(() => {
    if (open) {
      loadGoals();
    }
  }, [open]);

  // Trigger wiggle animation when form has errors
  useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      setShouldWiggle(true);
      const timer = setTimeout(() => setShouldWiggle(false), 500);
      return () => clearTimeout(timer);
    }
  }, [form.formState.errors]);
  const loadGoals = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data,
        error
      } = await supabase.from('user_goals').select('*').eq('user_id', user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading goals:', error);
        return;
      }
      if (data) {
        form.reset({
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
  const onSubmit = async (values: GoalsFormValues) => {
    setIsLoading(true);

    try {
      const goalsPayload = {
        goal_weight: values.goal_weight ? parseFloat(values.goal_weight) : null,
        goal_body_fat_percentage: values.goal_body_fat_percentage ? parseFloat(values.goal_body_fat_percentage) : null,
        goal_skin_fold_mm: values.goal_skin_fold_mm ? parseFloat(values.goal_skin_fold_mm) : null,
        goal_avg_daily_calories: values.goal_avg_daily_calories ? parseInt(values.goal_avg_daily_calories) : null,
        goal_avg_exercise_min_per_day: values.goal_avg_exercise_min_per_day ? parseInt(values.goal_avg_exercise_min_per_day) : null,
      };

      const { data, error } = await supabase.functions.invoke("update-goals", {
        body: goalsPayload,
      });

      if (error) throw error;
      
      // Parse server-side validation errors if present
      if (data?.error) {
        if (data.details) {
          // Map server errors to form fields
          Object.entries(data.details).forEach(([field, message]) => {
            form.setError(field as keyof GoalsFormValues, {
              type: "server",
              message: message as string
            });
          });
          setShouldWiggle(true);
          setTimeout(() => setShouldWiggle(false), 500);
          return;
        }
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Your goals have been saved.",
      });

      if (onGoalsUpdated) {
        onGoalsUpdated();
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving goals:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save goals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onInvalid = () => {
    setShouldWiggle(true);
    setTimeout(() => setShouldWiggle(false), 500);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-[425px] max-h-[90vh] overflow-y-auto",
        shouldWiggle && "animate-[wiggle_0.5s_ease-in-out]"
      )}>
        <DialogHeader>
          <DialogTitle className="py-[8px]">Set Your Fitness Goals</DialogTitle>
          <DialogDescription>
            Define your target fitness metrics. These goals will persist across all your weekly entries.
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4 p-1.5">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="goal_weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goal Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="150.0" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goal_body_fat_percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goal Body Fat (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="20.0" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="goal_skin_fold_mm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Belly Skinfold (mm)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1" 
                          placeholder="18.0" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="goal_avg_exercise_min_per_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goal Exercise Min/Day</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="30" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goal_avg_daily_calories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goal Daily Calories</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="2000" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
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
                    disabled={isLoading || !form.formState.isValid}
                  >
                    {isLoading ? "Saving..." : "Save Goals"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}