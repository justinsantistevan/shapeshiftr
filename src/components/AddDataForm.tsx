import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  weight: z
    .string()
    .optional()
    .refine((val) => !val || (parseFloat(val) >= 0 && parseFloat(val) <= 400), {
      message: "Weight must be between 0 and 400 lbs",
    }),
  body_fat_percentage: z
    .string()
    .optional()
    .refine((val) => !val || (parseFloat(val) >= 0 && parseFloat(val) <= 50), {
      message: "Body fat must be between 0% and 50%",
    }),
  skin_fold_mm: z
    .string()
    .optional()
    .refine((val) => !val || (parseFloat(val) >= 1 && parseFloat(val) <= 100), {
      message: "Skinfold must be between 1 and 100 mm",
    }),
  avg_exercise_min_per_day: z
    .string()
    .optional()
    .refine((val) => !val || (parseInt(val) >= 0 && parseInt(val) <= 300), {
      message: "Exercise minutes must be between 0 and 300",
    }),
  avg_daily_calories: z
    .string()
    .optional()
    .refine((val) => !val || (parseInt(val) >= 0 && parseInt(val) <= 10000), {
      message: "Calories must be between 0 and 10000",
    }),
  notes: z.string().optional(),
});
interface AddDataFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
export function AddDataForm({ open, onOpenChange, onSuccess }: AddDataFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [shouldWiggle, setShouldWiggle] = useState(false);
  const getWeekStartDate = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Subtract days to get to Sunday
    const weekStart = new Date(d.setDate(diff));
    // Format as YYYY-MM-DD to ensure consistency
    return format(weekStart, "yyyy-MM-dd");
  };
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Get to Sunday
    return new Date(today.setDate(diff));
  });
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null);
  const [sidePhoto, setSidePhoto] = useState<File | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      weight: "",
      body_fat_percentage: "",
      skin_fold_mm: "",
      avg_daily_calories: "",
      avg_exercise_min_per_day: "",
      notes: "",
    },
  });

  // Trigger wiggle on validation errors
  const onInvalid = () => {
    setShouldWiggle(true);
    setTimeout(() => setShouldWiggle(false), 500);
  };

  // Wiggle when any field shows an error (live as user types)
  useEffect(() => {
    const hasErrors = Object.keys(form.formState.errors).length > 0;
    if (hasErrors) {
      setShouldWiggle(true);
      const t = setTimeout(() => setShouldWiggle(false), 500);
      return () => clearTimeout(t);
    }
  }, [form.formState.errors]);

  const uploadPhoto = async (file: File, photoType: "front" | "side"): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${format(selectedWeekStart, "yyyy-MM-dd")}/${photoType}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("fitness-photos").upload(fileName, file, {
      upsert: true,
    });
    if (uploadError) {
      throw uploadError;
    }
    
    // Get signed URL for private bucket access (expires in 1 year)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("fitness-photos")
      .createSignedUrl(fileName, 31536000); // 1 year expiry
    
    if (signedError || !signedData) {
      throw signedError || new Error("Failed to create signed URL");
    }
    
    return signedData.signedUrl;
  };
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to add data.",
          variant: "destructive",
        });
        return;
      }

      // Upload photos if provided
      let frontPhotoUrl = null;
      let sidePhotoUrl = null;
      if (frontPhoto) {
        frontPhotoUrl = await uploadPhoto(frontPhoto, "front");
      }
      if (sidePhoto) {
        sidePhotoUrl = await uploadPhoto(sidePhoto, "side");
      }

      // Check if entry already exists
      const weekStartFormatted = format(selectedWeekStart, "yyyy-MM-dd");
      const { data: existingEntry } = await supabase
        .from("weekly_fitness_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start_date", weekStartFormatted)
        .single();

      // Prepare data for insertion/update, only updating fields with new values
      const insertData: any = {
        user_id: user.id,
        week_start_date: weekStartFormatted,
      };

      // Only include fields that have new values, preserve existing ones
      if (values.weight) insertData.weight = parseFloat(values.weight);
      if (values.body_fat_percentage) insertData.body_fat_percentage = parseFloat(values.body_fat_percentage);
      if (values.skin_fold_mm) insertData.skin_fold_mm = parseFloat(values.skin_fold_mm);
      if (values.avg_daily_calories) insertData.avg_daily_calories = parseInt(values.avg_daily_calories);
      if (values.avg_exercise_min_per_day)
        insertData.avg_exercise_min_per_day = parseInt(values.avg_exercise_min_per_day);
      if (values.notes) insertData.notes = values.notes;

      // Always update photos if new ones are uploaded
      if (frontPhotoUrl) insertData.front_photo_url = frontPhotoUrl;
      if (sidePhotoUrl) insertData.side_photo_url = sidePhotoUrl;
      const { error } = await supabase.from("weekly_fitness_entries").upsert(insertData, {
        onConflict: "user_id,week_start_date",
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
          description: "Fitness data and photos saved successfully.",
        });

        // Reset form
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day;
        setSelectedWeekStart(new Date(today.setDate(diff)));
        form.reset();
        setFrontPhoto(null);
        setSidePhoto(null);
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-[425px] max-h-[90vh] overflow-y-auto", shouldWiggle && "animate-wiggle")}>
        <DialogHeader>
          <DialogTitle className="pt-1">Add Fitness Data</DialogTitle>
          <DialogDescription>Track your weekly fitness metrics. One entry per week.</DialogDescription>
        </DialogHeader>

        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4 px-1.5 py-1.5">
                <div className="space-y-2">
                  <Label>Week Starting (Sunday)</Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedWeekStart && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedWeekStart ? format(selectedWeekStart, "PPP") : "Pick a Sunday"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedWeekStart}
                        onSelect={(date) => {
                          if (date) {
                            // Ensure the selected date is a Sunday
                            const day = date.getDay();
                            if (day === 0) {
                              setSelectedWeekStart(date);
                              setIsCalendarOpen(false); // Close calendar after selection
                            } else {
                              // If not Sunday, find the previous Sunday
                              const diff = date.getDate() - day;
                              const sunday = new Date(date);
                              sunday.setDate(diff);
                              setSelectedWeekStart(sunday);
                              setIsCalendarOpen(false); // Close calendar after selection
                            }
                          }
                        }}
                        disabled={(date) => {
                          // Only allow Sundays
                          return date.getDay() !== 0;
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Only Sundays can be selected as week start dates</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="150.0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="body_fat_percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body Fat (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="20.0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="skin_fold_mm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Belly Skinfold (mm)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="18.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="avg_exercise_min_per_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avg Exercise Min/Day</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="avg_daily_calories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avg Daily Calories</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="How did you feel today? Any observations?"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Progress Photos</Label>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="front_photo">Front Photo</Label>
                        <Input
                          id="front_photo"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            setFrontPhoto(file || null);
                          }}
                          className="cursor-pointer"
                        />
                        {frontPhoto && <p className="text-xs text-muted-foreground">Selected: {frontPhoto.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="side_photo">Side Photo</Label>
                        <Input
                          id="side_photo"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            setSidePhoto(file || null);
                          }}
                          className="cursor-pointer"
                        />
                        {sidePhoto && <p className="text-xs text-muted-foreground">Selected: {sidePhoto.name}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isLoading || !form.formState.isValid}>
                    {isLoading ? "Saving..." : "Save Data"}
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
