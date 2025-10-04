import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
interface AddDataFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
export function AddDataForm({
  open,
  onOpenChange,
  onSuccess
}: AddDataFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const getWeekStartDate = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Subtract days to get to Sunday
    const weekStart = new Date(d.setDate(diff));
    // Format as YYYY-MM-DD to ensure consistency
    return format(weekStart, 'yyyy-MM-dd');
  };
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Get to Sunday
    return new Date(today.setDate(diff));
  });
  const [formData, setFormData] = useState({
    weight: "",
    body_fat_percentage: "",
    skin_fold_mm: "",
    avg_daily_calories: "",
    avg_exercise_min_per_day: "",
    notes: ""
  });
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null);
  const [sidePhoto, setSidePhoto] = useState<File | null>(null);
  const {
    toast
  } = useToast();
  const uploadPhoto = async (file: File, photoType: 'front' | 'side'): Promise<string | null> => {
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${format(selectedWeekStart, 'yyyy-MM-dd')}/${photoType}.${fileExt}`;
    const {
      error: uploadError
    } = await supabase.storage.from('fitness-photos').upload(fileName, file, {
      upsert: true
    });
    if (uploadError) {
      throw uploadError;
    }
    const {
      data: {
        publicUrl
      }
    } = supabase.storage.from('fitness-photos').getPublicUrl(fileName);
    return publicUrl;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to add data.",
          variant: "destructive"
        });
        return;
      }

      // Upload photos if provided
      let frontPhotoUrl = null;
      let sidePhotoUrl = null;
      if (frontPhoto) {
        frontPhotoUrl = await uploadPhoto(frontPhoto, 'front');
      }
      if (sidePhoto) {
        sidePhotoUrl = await uploadPhoto(sidePhoto, 'side');
      }

      // Check if entry already exists
      const weekStartFormatted = format(selectedWeekStart, 'yyyy-MM-dd');
      const {
        data: existingEntry
      } = await supabase.from('weekly_fitness_entries').select('*').eq('user_id', user.id).eq('week_start_date', weekStartFormatted).single();

      // Prepare data for insertion/update, only updating fields with new values
      const insertData: any = {
        user_id: user.id,
        week_start_date: weekStartFormatted
      };

      // Only include fields that have new values, preserve existing ones
      if (formData.weight) insertData.weight = parseFloat(formData.weight);
      if (formData.body_fat_percentage) insertData.body_fat_percentage = parseFloat(formData.body_fat_percentage);
      if (formData.skin_fold_mm) insertData.skin_fold_mm = parseFloat(formData.skin_fold_mm);
      if (formData.avg_daily_calories) insertData.avg_daily_calories = parseInt(formData.avg_daily_calories);
      if (formData.avg_exercise_min_per_day) insertData.avg_exercise_min_per_day = parseInt(formData.avg_exercise_min_per_day);
      if (formData.notes) insertData.notes = formData.notes;

      // Always update photos if new ones are uploaded
      if (frontPhotoUrl) insertData.front_photo_url = frontPhotoUrl;
      if (sidePhotoUrl) insertData.side_photo_url = sidePhotoUrl;
      const {
        error
      } = await supabase.from('weekly_fitness_entries').upsert(insertData, {
        onConflict: 'user_id,week_start_date'
      });
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success!",
          description: "Fitness data and photos saved successfully."
        });

        // Reset form
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day;
        setSelectedWeekStart(new Date(today.setDate(diff)));
        setFormData({
          weight: "",
          body_fat_percentage: "",
          skin_fold_mm: "",
          avg_daily_calories: "",
          avg_exercise_min_per_day: "",
          notes: ""
        });
        setFrontPhoto(null);
        setSidePhoto(null);
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
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
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pt-1">Add Fitness Data</DialogTitle>
          <DialogDescription>
            Track your weekly fitness metrics. One entry per week.
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-4 px-1.5 py-1.5">
              <div className="space-y-2">
                <Label>Week Starting (Sunday)</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedWeekStart && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedWeekStart ? format(selectedWeekStart, "PPP") : "Pick a Sunday"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={selectedWeekStart} onSelect={date => {
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
                  }} disabled={date => {
                    // Only allow Sundays
                    return date.getDay() !== 0;
                  }} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Only Sundays can be selected as week start dates
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (lbs)</Label>
                  <Input id="weight" type="number" step="0.1" min="50" max="400" placeholder="150.0" value={formData.weight} onChange={e => handleInputChange('weight', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body_fat">Body Fat (%)</Label>
                  <Input id="body_fat" type="number" step="0.1" min="0" max="50" placeholder="20.0" value={formData.body_fat_percentage} onChange={e => handleInputChange('body_fat_percentage', e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skin_fold">Belly Skinfold (mm)</Label>
                <Input id="skin_fold" type="number" step="0.1" min="0" max="100" placeholder="18.0" value={formData.skin_fold_mm} onChange={e => handleInputChange('skin_fold_mm', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="avg_exercise_min">Avg Exercise Min/Day</Label>
                  <Input id="avg_exercise_min" type="number" min="0" max="600" placeholder="30" value={formData.avg_exercise_min_per_day} onChange={e => handleInputChange('avg_exercise_min_per_day', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avg_daily_calories">Avg Daily Calories</Label>
                  <Input id="avg_daily_calories" type="number" min="0" max="10000" placeholder="2000" value={formData.avg_daily_calories} onChange={e => handleInputChange('avg_daily_calories', e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" placeholder="How did you feel today? Any observations?" value={formData.notes} onChange={e => handleInputChange('notes', e.target.value)} className="min-h-[80px]" />
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-medium">Progress Photos</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="front_photo">Front Photo</Label>
                      <Input id="front_photo" type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      setFrontPhoto(file || null);
                    }} className="cursor-pointer" />
                      {frontPhoto && <p className="text-xs text-muted-foreground">
                          Selected: {frontPhoto.name}
                        </p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="side_photo">Side Photo</Label>
                      <Input id="side_photo" type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      setSidePhoto(file || null);
                    }} className="cursor-pointer" />
                      {sidePhoto && <p className="text-xs text-muted-foreground">
                          Selected: {sidePhoto.name}
                        </p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Data"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>;
}