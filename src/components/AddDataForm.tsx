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
export function AddDataForm({
  open,
  onOpenChange,
  onSuccess
}: AddDataFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const getWeekStartDate = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Subtract days to get to Sunday
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };
  const [formData, setFormData] = useState({
    week_start_date: getWeekStartDate(new Date()),
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
    const fileName = `${user.id}/${formData.week_start_date}/${photoType}.${fileExt}`;
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

      // Prepare data for insertion, converting strings to numbers where needed
      const insertData = {
        user_id: user.id,
        week_start_date: formData.week_start_date,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        body_fat_percentage: formData.body_fat_percentage ? parseFloat(formData.body_fat_percentage) : null,
        skin_fold_mm: formData.skin_fold_mm ? parseFloat(formData.skin_fold_mm) : null,
        avg_daily_calories: formData.avg_daily_calories ? parseInt(formData.avg_daily_calories) : null,
        avg_exercise_min_per_day: formData.avg_exercise_min_per_day ? parseInt(formData.avg_exercise_min_per_day) : null,
        front_photo_url: frontPhotoUrl,
        side_photo_url: sidePhotoUrl,
        notes: formData.notes || null
      };
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
        setFormData({
          week_start_date: getWeekStartDate(new Date()),
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
          <DialogTitle>Add Fitness Data</DialogTitle>
          <DialogDescription>
            Track your weekly fitness metrics. One entry per week.
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-4 px-1.5 py-1.5">
              <div className="space-y-2">
                <Label htmlFor="week_start_date">Week Starting</Label>
                <Input id="week_start_date" type="date" value={formData.week_start_date} onChange={e => handleInputChange('week_start_date', e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (lbs)</Label>
                  <Input id="weight" type="number" step="0.1" placeholder="150.5" value={formData.weight} onChange={e => handleInputChange('weight', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body_fat">Body Fat (%)</Label>
                  <Input id="body_fat" type="number" step="0.1" placeholder="15.5" value={formData.body_fat_percentage} onChange={e => handleInputChange('body_fat_percentage', e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skin_fold">Skin Fold (mm)</Label>
                <Input id="skin_fold" type="number" step="0.1" placeholder="8.5" value={formData.skin_fold_mm} onChange={e => handleInputChange('skin_fold_mm', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="avg_exercise_min">Avg Exercise Min/Day</Label>
                  <Input id="avg_exercise_min" type="number" placeholder="30" value={formData.avg_exercise_min_per_day} onChange={e => handleInputChange('avg_exercise_min_per_day', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avg_daily_calories">Avg Daily Calories</Label>
                  <Input id="avg_daily_calories" type="number" placeholder="2000" value={formData.avg_daily_calories} onChange={e => handleInputChange('avg_daily_calories', e.target.value)} />
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