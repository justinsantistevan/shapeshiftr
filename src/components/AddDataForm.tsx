import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
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
import { usePhotoCropping } from "@/hooks/usePhotoCropping";
import { useModalViewport } from "@/hooks/useModalViewport";

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
  notes: z.string().max(2000, "Notes must be less than 2000 characters").optional(),
});
interface AddDataFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
export function AddDataForm({ open, onOpenChange, onSuccess }: AddDataFormProps) {
  const viewportStyle = useModalViewport(open);
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
  const [isCroppingFront, setIsCroppingFront] = useState(false);
  const [isCroppingSide, setIsCroppingSide] = useState(false);
  const { toast } = useToast();
  const { cropPhoto, isProcessing, error: croppingError, clearError } = usePhotoCropping();

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

  // Clear photos when modal closes
  useEffect(() => {
    if (!open) {
      setFrontPhoto(null);
      setSidePhoto(null);
      setIsCroppingFront(false);
      setIsCroppingSide(false);
      clearError();
    }
  }, [open, clearError]);

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

  // Handle front photo selection and cropping
  const handleFrontPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCroppingFront(true);
    clearError();

    const result = await cropPhoto(file, 'front');

    if (result) {
      setFrontPhoto(result.croppedFile);
      toast({
        title: "Front photo processed",
        description: "Photo has been cropped and is ready to upload.",
      });
    } else if (croppingError) {
      toast({
        title: "Error processing front photo",
        description: croppingError,
        variant: "destructive",
      });
    }

    setIsCroppingFront(false);
  };

  // Handle side photo selection and cropping
  const handleSidePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCroppingSide(true);
    clearError();

    const result = await cropPhoto(file, 'side');

    if (result) {
      setSidePhoto(result.croppedFile);
      toast({
        title: "Side photo processed",
        description: "Photo has been cropped and is ready to upload.",
      });
    } else if (croppingError) {
      toast({
        title: "Error processing side photo",
        description: croppingError,
        variant: "destructive",
      });
    }

    setIsCroppingSide(false);
  };

  const uploadPhoto = async (file: File, photoType: "front" | "side"): Promise<{
    storagePath: string;
    signedUrl: string;
    expiresAt: string;
  } | null> => {
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

    return {
      storagePath: `fitness-photos/${fileName}`,
      signedUrl: signedData.signedUrl,
      expiresAt: new Date(Date.now() + 31536000 * 1000).toISOString(),
    };
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
      let frontPhotoResult = null;
      let sidePhotoResult = null;
      if (frontPhoto) {
        frontPhotoResult = await uploadPhoto(frontPhoto, "front");
      }
      if (sidePhoto) {
        sidePhotoResult = await uploadPhoto(sidePhoto, "side");
      }

      // Check if entry already exists
      const weekStartFormatted = format(selectedWeekStart, "yyyy-MM-dd");
      const { data: existingEntry } = await supabase
        .from("weekly_fitness_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_end_date", weekStartFormatted)
        .single();

      // Prepare data for insertion/update, only updating fields with new values
      const insertData: any = {
        user_id: user.id,
        week_end_date: weekStartFormatted,
      };

      // Only include fields that have new values, preserve existing ones
      if (values.weight) insertData.weight = parseFloat(values.weight);
      if (values.body_fat_percentage) insertData.body_fat_percentage = parseFloat(values.body_fat_percentage);
      if (values.skin_fold_mm) insertData.skin_fold_mm = parseFloat(values.skin_fold_mm);
      if (values.avg_daily_calories) insertData.avg_daily_calories = parseInt(values.avg_daily_calories);
      if (values.avg_exercise_min_per_day)
        insertData.avg_exercise_min_per_day = parseInt(values.avg_exercise_min_per_day);
      if (values.notes) insertData.notes = values.notes;

      // Always update photos if new ones are uploaded (store path + cached signed URL)
      if (frontPhotoResult) {
        insertData.front_photo_url = frontPhotoResult.storagePath;
        insertData.front_signed_url = frontPhotoResult.signedUrl;
        insertData.front_signed_url_expires_at = frontPhotoResult.expiresAt;
      }
      if (sidePhotoResult) {
        insertData.side_photo_url = sidePhotoResult.storagePath;
        insertData.side_signed_url = sidePhotoResult.signedUrl;
        insertData.side_signed_url_expires_at = sidePhotoResult.expiresAt;
      }
      const { error } = await supabase.from("weekly_fitness_entries").upsert(insertData, {
        onConflict: "user_id,week_end_date",
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
      <DialogContent
        style={viewportStyle}
        className={cn(
          // Use the visual rectangle for position AND size; dvh remains the fallback.
          "sm:max-w-[425px] left-[calc(var(--modal-viewport-left,0px)+var(--modal-viewport-width,100%)/2)] w-[var(--modal-viewport-width,100%)] top-[calc(var(--modal-viewport-top,0px)+1rem+env(safe-area-inset-top))] translate-y-0 max-h-[calc(var(--modal-viewport-height,100dvh)-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:top-[calc(var(--modal-viewport-top,0px)+(var(--modal-viewport-height,100dvh)+env(safe-area-inset-top)-env(safe-area-inset-bottom))/2)] sm:translate-y-[-50%]",
          shouldWiggle && "animate-wiggle",
        )}
      >
        <DialogHeader>
          <DialogTitle className="pt-1">Add Fitness Data</DialogTitle>
          <DialogDescription>Track your weekly fitness metrics. One entry per week.</DialogDescription>
        </DialogHeader>

        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4 px-1.5 py-1.5">
                <div className="space-y-2">
                  <Label>Week ending (Sunday)</Label>
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
                  <p className="text-xs text-muted-foreground">Enter data for the week ending on the selected Sunday</p>
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
                        <Input type="number" step="0.1" placeholder="18" {...field} />
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
                      <p className="text-xs text-muted-foreground">
                        {field.value?.length || 0}/2000 characters
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Progress Photos</Label>
                    <p className="text-xs text-muted-foreground">
                      Stand with your full body in frame, arms up at 90 degrees, feet shoulder-width apart.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="front_photo">Front Photo</Label>
                        <Input
                          id="front_photo"
                          type="file"
                          accept="image/*"
                          onChange={handleFrontPhotoChange}
                          disabled={isCroppingFront || isCroppingSide}
                          className="cursor-pointer py-0 h-10 flex items-center file:h-full file:mr-4 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:cursor-pointer text-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {isCroppingFront ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing front photo...
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {frontPhoto ? `✓ ${frontPhoto.name}` : "No file chosen"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="side_photo">Side Photo</Label>
                        <Input
                          id="side_photo"
                          type="file"
                          accept="image/*"
                          onChange={handleSidePhotoChange}
                          disabled={isCroppingFront || isCroppingSide}
                          className="cursor-pointer py-0 h-10 flex items-center file:h-full file:mr-4 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:cursor-pointer text-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {isCroppingSide ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing side photo...
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {sidePhoto ? `✓ ${sidePhoto.name}` : "No file chosen"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isLoading || !form.formState.isValid || isCroppingFront || isCroppingSide}
                  >
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
