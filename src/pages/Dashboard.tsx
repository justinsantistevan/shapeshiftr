import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InspirationalQuote } from "@/components/InspirationalQuote";
import { MetricsChart } from "@/components/MetricsChart";
import { FitnessAffirmations } from "@/components/FitnessAffirmations";
import { AddDataForm } from "@/components/AddDataForm";
import { GoalsForm } from "@/components/GoalsForm";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import shapeshiftrLogo from "@/assets/shapeshiftr-logo.png";

interface DashboardProps {
  onSignOut: () => void;
}

export function Dashboard({ onSignOut }: DashboardProps) {
  const [showAddDataForm, setShowAddDataForm] = useState(false);
  const [showGoalsForm, setShowGoalsForm] = useState(false);
  const [fitnessPhotos, setFitnessPhotos] = useState<Array<{
    front_photo_url?: string;
    side_photo_url?: string;
    week_start_date: string;
  }>>([]);
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "See you next time!",
      });
      onSignOut();
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchFitnessPhotos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('weekly_fitness_entries')
        .select('front_photo_url, side_photo_url, week_start_date')
        .eq('user_id', user.id)
        .not('front_photo_url', 'is', null)
        .not('side_photo_url', 'is', null)
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      setFitnessPhotos(data || []);
    } catch (error) {
      console.error('Error fetching fitness photos:', error);
    }
  };

  useEffect(() => {
    fetchFitnessPhotos();
  }, []);

  const handleDataAdded = () => {
    fetchFitnessPhotos(); // Refresh photos when new data is added
    toast({
      title: "Data Added",
      description: "Your fitness data has been successfully recorded.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src={shapeshiftrLogo} 
              alt="ShapeShiftr" 
              className="h-8 w-8"
            />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              ShapeShiftr
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => setShowAddDataForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Data
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowGoalsForm(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Goals
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Inspirational Quote */}
        <section className="animate-slide-up">
          <InspirationalQuote />
        </section>

        {/* Metrics Dashboard */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <MetricsChart />
          </div>

          {/* Quick Stats */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
              <div className="fitness-card p-4 text-center">
                <div className="metric-value">178.1</div>
                <div className="text-sm text-muted-foreground">Current Weight</div>
                <div className="text-xs text-accent mt-1">↓ 2.4 lbs this month</div>
              </div>
              <div className="fitness-card p-4 text-center">
                <div className="metric-value">17.0%</div>
                <div className="text-sm text-muted-foreground">Body Fat</div>
                <div className="text-xs text-accent mt-1">↓ 1.2% this month</div>
              </div>
              <div className="fitness-card p-4 text-center">
                <div className="metric-value">52</div>
                <div className="text-sm text-muted-foreground">Avg Exercise Min/Day</div>
                <div className="text-xs text-accent mt-1">↑ 7 min this month</div>
              </div>
              <div className="fitness-card p-4 text-center">
                <div className="metric-value">13mm</div>
                <div className="text-sm text-muted-foreground">Skin Fold</div>
                <div className="text-xs text-accent mt-1">↓ 2mm this month</div>
              </div>
            </div>
          </div>
        </section>

        {/* Progress Photos Section */}
        <section className="animate-slide-up" style={{ animationDelay: "0.6s" }}>
          <div className="fitness-card p-6">
            <h3 className="text-xl font-semibold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Progress Photos
            </h3>
            {fitnessPhotos.length > 0 ? (
              <Carousel className="w-full max-w-4xl mx-auto">
                <CarouselContent>
                  {fitnessPhotos.map((entry, index) => (
                    <CarouselItem key={index}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-center">Front View</h4>
                          {entry.front_photo_url && (
                            <img
                              src={entry.front_photo_url}
                              alt={`Front view - ${entry.week_start_date}`}
                              className="w-full h-64 object-cover rounded-lg"
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-center">Side View</h4>
                          {entry.side_photo_url && (
                            <img
                              src={entry.side_photo_url}
                              alt={`Side view - ${entry.week_start_date}`}
                              className="w-full h-64 object-cover rounded-lg"
                            />
                          )}
                        </div>
                      </div>
                      <p className="text-center text-sm text-muted-foreground mt-2">
                        Week of {new Date(entry.week_start_date).toLocaleDateString()}
                      </p>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <p>Upload your first progress photos to see them here!</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowAddDataForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Photos
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Affirmations */}
        <section className="animate-slide-up" style={{ animationDelay: "0.8s" }}>
          <FitnessAffirmations />
        </section>
      </main>

      <AddDataForm 
        open={showAddDataForm} 
        onOpenChange={setShowAddDataForm}
        onSuccess={handleDataAdded}
      />
      
      <GoalsForm 
        open={showGoalsForm} 
        onOpenChange={setShowGoalsForm}
      />
    </div>
  );
}