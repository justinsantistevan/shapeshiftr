import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Settings, Menu, Scale, Activity, Zap, Ruler, UtensilsCrossed, TrendingUp, TrendingDown, MessageSquare } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InspirationalQuote } from "@/components/InspirationalQuote";
import { MetricsChart, MetricsChartRef } from "@/components/MetricsChart";
import { FitnessAffirmations, FitnessAffirmationsRef } from "@/components/FitnessAffirmations";
import { AffirmationsManager } from "@/components/AffirmationsManager";
import { AddDataForm } from "@/components/AddDataForm";
import { GoalsForm } from "@/components/GoalsForm";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from "@/components/ui/carousel";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateFitnessStats, formatChange, formatCurrentValue, FitnessStats } from "@/lib/fitnessCalculations";
import shapeshiftrLogo from "/lovable-uploads/d1025a10-8e0c-4dc2-90f2-289110e6f482.png";
interface DashboardProps {
  onSignOut: () => void;
}
export function Dashboard({
  onSignOut
}: DashboardProps) {
  const [showAddDataForm, setShowAddDataForm] = useState(false);
  const [showGoalsForm, setShowGoalsForm] = useState(false);
  const [showAffirmationsManager, setShowAffirmationsManager] = useState(false);
  const [fitnessPhotos, setFitnessPhotos] = useState<Array<{
    front_photo_url?: string;
    side_photo_url?: string;
    week_start_date: string;
  }>>([]);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<{
    before?: {
      front_photo_url?: string;
      side_photo_url?: string;
      week_start_date: string;
    };
    after?: {
      front_photo_url?: string;
      side_photo_url?: string;
      week_start_date: string;
    };
  }>({});
  const [selectionStep, setSelectionStep] = useState<'before' | 'after'>('before');
  const [fitnessStats, setFitnessStats] = useState<FitnessStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const fitnessAffirmationsRef = useRef<FitnessAffirmationsRef>(null);
  const metricsChartRef = useRef<MetricsChartRef>(null);
  const {
    toast
  } = useToast();
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "See you next time!"
      });
      onSignOut();
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };
  const fetchFitnessPhotos = async () => {
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
      } = await supabase.from('weekly_fitness_entries').select('front_photo_url, side_photo_url, week_start_date').eq('user_id', user.id).or('front_photo_url.not.is.null,side_photo_url.not.is.null').order('week_start_date', {
        ascending: true
      });
      if (error) throw error;
      setFitnessPhotos(data || []);
    } catch (error) {
      console.error('Error fetching fitness photos:', error);
    }
  };
  const fetchFitnessStats = async () => {
    setIsLoadingStats(true);
    try {
      const stats = await calculateFitnessStats();
      setFitnessStats(stats);
    } catch (error) {
      console.error('Error fetching fitness stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };
  useEffect(() => {
    fetchFitnessPhotos();
    fetchFitnessStats();
  }, []);

  // Set carousel to show most recent photos when data is loaded
  useEffect(() => {
    if (carouselApi && fitnessPhotos.length > 0) {
      // Go to the last photo (most recent)
      carouselApi.scrollTo(fitnessPhotos.length - 1);
    }
  }, [carouselApi, fitnessPhotos]);
  const handleDataAdded = () => {
    fetchFitnessPhotos(); // Refresh photos when new data is added
    fetchFitnessStats(); // Refresh stats when new data is added
    toast({
      title: "Data Added",
      description: "Your fitness data has been successfully recorded."
    });
  };
  const handleCompareMode = () => {
    setIsCompareMode(true);
    setSelectionStep('before');
    setSelectedPhotos({});
  };
  const handlePhotoSelect = (photo: {
    front_photo_url?: string;
    side_photo_url?: string;
    week_start_date: string;
  }) => {
    if (selectionStep === 'before') {
      setSelectedPhotos({
        before: photo
      });
      setSelectionStep('after');
    } else {
      setSelectedPhotos(prev => ({
        ...prev,
        after: photo
      }));
    }
  };
  const handleResetComparison = () => {
    setIsCompareMode(false);
    setSelectedPhotos({});
    setSelectionStep('before');
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-2">
            <img src={shapeshiftrLogo} alt="ShapeShiftr" className="h-8 w-8 sm:h-9 sm:w-9" />
            <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              ShapeShiftr
            </h1>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-3">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => setShowAddDataForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Data
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowGoalsForm(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Goals
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAffirmationsManager(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Affirmations
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col space-y-4 mt-8">
                  <Button variant="outline" className="justify-start" onClick={() => setShowAddDataForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Data
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => setShowGoalsForm(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Goals
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => setShowAffirmationsManager(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Affirmations
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
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
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[600px]">
          {/* Chart Section */}
          <div className="lg:col-span-2 animate-slide-up h-full" style={{
          animationDelay: "0.2s"
        }}>
            <MetricsChart ref={metricsChartRef} />
          </div>

          {/* Quick Stats */}
          <div className="space-y-4 animate-slide-up flex flex-col h-full" style={{
          animationDelay: "0.4s"
        }}>
            <div className="grid grid-cols-1 gap-3 flex-1">
              <div className="fitness-card p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Scale className="h-5 w-5 text-primary mr-2" />
                  <div className="text-sm text-muted-foreground">Current Weight</div>
                </div>
                <div className="metric-value">
                  {isLoadingStats ? "..." : formatCurrentValue(fitnessStats?.weight || {
                  current: null,
                  change: null,
                  direction: 'neutral',
                  unit: 'lbs'
                })}
                </div>
                <div className="text-xs mt-1 flex items-center justify-center gap-1">
                  {isLoadingStats ? "" : (() => {
                  const changeData = formatChange(fitnessStats?.weight || {
                    current: null,
                    change: null,
                    direction: 'neutral',
                    unit: 'lbs'
                  });
                  return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                        {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                        <span>{changeData.text}</span>
                      </div> : null;
                })()}
                </div>
              </div>
              <div className="fitness-card p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Activity className="h-5 w-5 text-primary mr-2" />
                  <div className="text-sm text-muted-foreground">Body Fat</div>
                </div>
                <div className="metric-value">
                  {isLoadingStats ? "..." : formatCurrentValue(fitnessStats?.bodyFat || {
                  current: null,
                  change: null,
                  direction: 'neutral',
                  unit: '%'
                })}
                </div>
                <div className="text-xs mt-1 flex items-center justify-center gap-1">
                  {isLoadingStats ? "" : (() => {
                  const changeData = formatChange(fitnessStats?.bodyFat || {
                    current: null,
                    change: null,
                    direction: 'neutral',
                    unit: '%'
                  });
                  return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                        {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                        <span>{changeData.text}</span>
                      </div> : null;
                })()}
                </div>
              </div>
              <div className="fitness-card p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Ruler className="h-5 w-5 text-primary mr-2" />
                  <div className="text-sm text-muted-foreground">Belly Skin Fold</div>
                </div>
                <div className="metric-value">
                  {isLoadingStats ? "..." : formatCurrentValue(fitnessStats?.skinFold || {
                  current: null,
                  change: null,
                  direction: 'neutral',
                  unit: 'mm'
                })}
                </div>
                <div className="text-xs mt-1 flex items-center justify-center gap-1">
                  {isLoadingStats ? "" : (() => {
                  const changeData = formatChange(fitnessStats?.skinFold || {
                    current: null,
                    change: null,
                    direction: 'neutral',
                    unit: 'mm'
                  });
                  return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                        {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                        <span>{changeData.text}</span>
                      </div> : null;
                })()}
                </div>
              </div>
              <div className="fitness-card p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="h-5 w-5 text-primary mr-2" />
                  <div className="text-sm text-muted-foreground">Avg Daily Exercise</div>
                </div>
                <div className="metric-value">
                  {isLoadingStats ? "..." : formatCurrentValue(fitnessStats?.exercise || {
                  current: null,
                  change: null,
                  direction: 'neutral',
                  unit: 'min'
                })}
                </div>
                <div className="text-xs mt-1 flex items-center justify-center gap-1">
                  {isLoadingStats ? "" : (() => {
                  const changeData = formatChange(fitnessStats?.exercise || {
                    current: null,
                    change: null,
                    direction: 'neutral',
                    unit: 'min'
                  });
                  return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                        {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                        <span>{changeData.text}</span>
                      </div> : null;
                })()}
                </div>
              </div>
              <div className="fitness-card p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary mr-2" />
                  <div className="text-sm text-muted-foreground">Avg Daily Calories</div>
                </div>
                <div className="metric-value">
                  {isLoadingStats ? "..." : formatCurrentValue(fitnessStats?.calories || {
                  current: null,
                  change: null,
                  direction: 'neutral',
                  unit: 'cal'
                })}
                </div>
                <div className="text-xs mt-1 flex items-center justify-center gap-1">
                  {isLoadingStats ? "" : (() => {
                  const changeData = formatChange(fitnessStats?.calories || {
                    current: null,
                    change: null,
                    direction: 'neutral',
                    unit: 'cal'
                  });
                  return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                        {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                        <span>{changeData.text}</span>
                      </div> : null;
                })()}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Progress Photos Section */}
        <section className="animate-slide-up" style={{
        animationDelay: "0.6s"
      }}>
          <div className="fitness-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Progress Photos
              </h3>
              {fitnessPhotos.length > 1 && !isCompareMode && <Button variant="outline" size="sm" onClick={handleCompareMode}>
                  Compare
                </Button>}
              {isCompareMode && <Button variant="outline" size="sm" onClick={handleResetComparison}>
                  Back to Gallery
                </Button>}
            </div>
            {fitnessPhotos.length > 0 ? !isCompareMode ? <Carousel setApi={setCarouselApi} className="w-full max-w-4xl mx-auto">
                  <CarouselContent>
                    {fitnessPhotos.map((entry, index) => <CarouselItem key={index}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-center">Front View</h4>
                            {entry.front_photo_url && <img src={entry.front_photo_url} alt={`Front view - ${entry.week_start_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-center">Side View</h4>
                            {entry.side_photo_url && <img src={entry.side_photo_url} alt={`Side view - ${entry.week_start_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                          </div>
                        </div>
                        <p className="text-center text-sm text-muted-foreground mt-2">
                          Week of {(() => {
                    const [year, month, day] = entry.week_start_date.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    return date.toLocaleDateString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                      year: 'numeric'
                    });
                  })()}
                        </p>
                      </CarouselItem>)}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel> : selectedPhotos.before && selectedPhotos.after ? <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Before Photos */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-center text-primary">Before</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-center">Front View</h5>
                          {selectedPhotos.before.front_photo_url && <img src={selectedPhotos.before.front_photo_url} alt={`Before front - ${selectedPhotos.before.week_start_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                        </div>
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-center">Side View</h5>
                          {selectedPhotos.before.side_photo_url && <img src={selectedPhotos.before.side_photo_url} alt={`Before side - ${selectedPhotos.before.week_start_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                        </div>
                      </div>
                      <p className="text-center text-sm text-muted-foreground">
                        {new Date(selectedPhotos.before.week_start_date).toLocaleDateString()}
                      </p>
                    </div>

                    {/* After Photos */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-center text-secondary">After</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-center">Front View</h5>
                          {selectedPhotos.after.front_photo_url && <img src={selectedPhotos.after.front_photo_url} alt={`After front - ${selectedPhotos.after.week_start_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                        </div>
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-center">Side View</h5>
                          {selectedPhotos.after.side_photo_url && <img src={selectedPhotos.after.side_photo_url} alt={`After side - ${selectedPhotos.after.week_start_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                        </div>
                      </div>
                      <p className="text-center text-sm text-muted-foreground">
                        {new Date(selectedPhotos.after.week_start_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div> : <div className="space-y-4">
                  <div className="text-center text-lg font-medium">
                    Select your {selectionStep} photo
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fitnessPhotos.map((entry, index) => <div key={index} className={`cursor-pointer border-2 rounded-lg p-2 transition-all hover:border-primary ${selectedPhotos.before === entry ? 'border-primary bg-primary/10' : 'border-border'}`} onClick={() => handlePhotoSelect(entry)}>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <h5 className="text-xs font-medium text-center">Front</h5>
                            {entry.front_photo_url && <img src={entry.front_photo_url} alt={`Front - ${entry.week_start_date}`} className="w-full aspect-[9/16] object-cover rounded" />}
                          </div>
                          <div className="space-y-1">
                            <h5 className="text-xs font-medium text-center">Side</h5>
                            {entry.side_photo_url && <img src={entry.side_photo_url} alt={`Side - ${entry.week_start_date}`} className="w-full aspect-[9/16] object-cover rounded" />}
                          </div>
                        </div>
                        <p className="text-center text-xs text-muted-foreground mt-1">
                          Week of {(() => {
                    const [year, month, day] = entry.week_start_date.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    return date.toLocaleDateString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                      year: 'numeric'
                    });
                  })()}
                        </p>
                      </div>)}
                  </div>
                  {selectedPhotos.before && <div className="text-center text-sm text-muted-foreground">
                      Before photo selected. Now select your after photo.
                    </div>}
                </div> : <div className="text-center text-muted-foreground py-12">
                <p>Upload your first progress photos to see them here!</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowAddDataForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Photos
                </Button>
              </div>}
          </div>
        </section>

        {/* Affirmations */}
        <section className="animate-slide-up" style={{
        animationDelay: "0.8s"
      }}>
          <FitnessAffirmations ref={fitnessAffirmationsRef} />
        </section>

        {/* Footer */}
        <footer className="text-center py-8 animate-slide-up" style={{
        animationDelay: "1s"
      }}>
          <p className="text-sm text-muted-foreground">
            Designed and built in a single Sunday afternoon using Lovable.
          </p>
        </footer>
      </main>

      <AddDataForm open={showAddDataForm} onOpenChange={setShowAddDataForm} onSuccess={handleDataAdded} />
      
      <GoalsForm open={showGoalsForm} onOpenChange={setShowGoalsForm} onGoalsUpdated={() => {
      // Refresh the chart when goals are updated
      metricsChartRef.current?.refreshGoals();
    }} />

      <Dialog open={showAffirmationsManager} onOpenChange={setShowAffirmationsManager}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Affirmations</DialogTitle>
            <DialogDescription>
              Add, edit, or delete your personal affirmations to keep you motivated on your fitness journey.
            </DialogDescription>
          </DialogHeader>
          <AffirmationsManager onAffirmationsChange={() => {
          // Refresh the affirmations display at the bottom of the page
          fitnessAffirmationsRef.current?.refreshAffirmations();
        }} />
        </DialogContent>
      </Dialog>
    </div>;
}