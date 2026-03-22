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
import { fetchUserGoals, UserGoals } from "@/lib/userGoals";
import { ProgressAnalysis } from "@/components/ProgressAnalysis";
import shapeshiftrLogo from "@/assets/shapeshiftr-logo-new-sq.png";
import { GlowingEffect } from "@/components/ui/glowing-effect";

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
    id: string;
    front_photo_url?: string | null;
    side_photo_url?: string | null;
    front_signed_url?: string | null;
    front_signed_url_expires_at?: string | null;
    side_signed_url?: string | null;
    side_signed_url_expires_at?: string | null;
    week_end_date: string;
  }>>([]);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<{
    before?: {
      front_photo_url?: string | null;
      side_photo_url?: string | null;
      front_signed_url?: string | null;
      side_signed_url?: string | null;
      week_end_date: string;
    };
    after?: {
      front_photo_url?: string | null;
      side_photo_url?: string | null;
      front_signed_url?: string | null;
      side_signed_url?: string | null;
      week_end_date: string;
    };
  }>({});
  const [selectionStep, setSelectionStep] = useState<'before' | 'after'>('before');
  const [fitnessStats, setFitnessStats] = useState<FitnessStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [userGoals, setUserGoals] = useState<UserGoals>({});
  const [goalsLoaded, setGoalsLoaded] = useState(false);
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
  const isSignedUrlValid = (expiresAt: string | null | undefined): boolean => {
    if (!expiresAt) return false;
    // Consider expired if within 24 hours of expiry
    return new Date(expiresAt).getTime() > Date.now() + 24 * 60 * 60 * 1000;
  };

  const generateAndCacheSignedUrl = async (
    entryId: string,
    photoUrl: string,
    photoType: 'front' | 'side'
  ): Promise<string | null> => {
    try {
      const pathMatch = photoUrl.match(/fitness-photos\/(.+)$/);
      const storagePath = pathMatch ? pathMatch[1] : null;
      if (!storagePath) return null;

      const { data: signedData, error: signedError } = await supabase.storage
        .from('fitness-photos')
        .createSignedUrl(storagePath, 31536000); // 1 year

      if (signedError || !signedData) {
        console.error(`Error creating signed URL for ${photoType} photo:`, signedError);
        return null;
      }

      const expiresAt = new Date(Date.now() + 31536000 * 1000).toISOString();
      const urlField = photoType === 'front' ? 'front_signed_url' : 'side_signed_url';
      const expiryField = photoType === 'front' ? 'front_signed_url_expires_at' : 'side_signed_url_expires_at';

      await supabase
        .from('weekly_fitness_entries')
        .update({ [urlField]: signedData.signedUrl, [expiryField]: expiresAt })
        .eq('id', entryId);

      return signedData.signedUrl;
    } catch (e) {
      console.error(`Error processing ${photoType} photo URL:`, e);
      return null;
    }
  };

  const resolveSignedUrlsForSlide = async (index: number) => {
    const entry = fitnessPhotos[index];
    if (!entry) return;

    let updated = false;
    const updatedEntry = { ...entry };

    if (entry.front_photo_url && !isSignedUrlValid(entry.front_signed_url_expires_at)) {
      const url = await generateAndCacheSignedUrl(entry.id, entry.front_photo_url, 'front');
      if (url) {
        updatedEntry.front_signed_url = url;
        updatedEntry.front_signed_url_expires_at = new Date(Date.now() + 31536000 * 1000).toISOString();
        updated = true;
      }
    }

    if (entry.side_photo_url && !isSignedUrlValid(entry.side_signed_url_expires_at)) {
      const url = await generateAndCacheSignedUrl(entry.id, entry.side_photo_url, 'side');
      if (url) {
        updatedEntry.side_signed_url = url;
        updatedEntry.side_signed_url_expires_at = new Date(Date.now() + 31536000 * 1000).toISOString();
        updated = true;
      }
    }

    if (updated) {
      setFitnessPhotos(prev => prev.map((p, i) => i === index ? updatedEntry : p));
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
      } = await supabase.from('weekly_fitness_entries').select('id, front_photo_url, side_photo_url, front_signed_url, front_signed_url_expires_at, side_signed_url, side_signed_url_expires_at, week_end_date').eq('user_id', user.id).or('front_photo_url.not.is.null,side_photo_url.not.is.null').order('week_end_date', {
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
  const fetchGoals = async () => {
    try {
      const goals = await fetchUserGoals();
      setUserGoals(goals);
    } catch (error) {
      console.error('Error fetching user goals:', error);
    } finally {
      setGoalsLoaded(true);
    }
  };
  useEffect(() => {
    fetchFitnessPhotos();
    fetchFitnessStats();
    fetchGoals();

    // Add event listeners for custom events from child components
    const handleOpenAddData = () => setShowAddDataForm(true);
    const handleOpenAffirmations = () => setShowAffirmationsManager(true);
    window.addEventListener('openAddData', handleOpenAddData);
    window.addEventListener('openAffirmations', handleOpenAffirmations);
    return () => {
      window.removeEventListener('openAddData', handleOpenAddData);
      window.removeEventListener('openAffirmations', handleOpenAffirmations);
    };
  }, []);

  // Set carousel to show most recent photos and lazy-load signed URLs
  useEffect(() => {
    if (carouselApi && fitnessPhotos.length > 0) {
      const lastIndex = fitnessPhotos.length - 1;
      // Use setTimeout to ensure carousel is ready after state update
      setTimeout(() => {
        carouselApi.scrollTo(lastIndex);
      }, 100);

      // Resolve signed URLs for the initial visible slide and adjacent
      for (let i = Math.max(0, lastIndex - 1); i <= lastIndex; i++) {
        resolveSignedUrlsForSlide(i);
      }

      // Resolve adjacent slides on carousel scroll
      const onSelect = () => {
        const current = carouselApi.selectedScrollSnap();
        for (let i = Math.max(0, current - 1); i <= Math.min(fitnessPhotos.length - 1, current + 1); i++) {
          resolveSignedUrlsForSlide(i);
        }
      };
      carouselApi.on('select', onSelect);
      return () => {
        carouselApi.off('select', onSelect);
      };
    }
  }, [carouselApi, fitnessPhotos.length]);
  const handleDataAdded = () => {
    fetchFitnessPhotos(); // Refresh photos when new data is added
    fetchFitnessStats(); // Refresh stats when new data is added
    fetchGoals(); // Refresh goals when new data is added
    metricsChartRef.current?.refreshGoals(); // Refresh chart data when new data is added
    toast({
      title: "Data Added",
      description: "Your fitness data has been successfully recorded."
    });
  };
  const handleGoalsUpdated = () => {
    fetchGoals(); // Refresh goals when updated
    metricsChartRef.current?.refreshGoals(); // Refresh chart data when goals are updated
    toast({
      title: "Goals Updated",
      description: "Your fitness goals have been successfully saved."
    });
  };
  const handleCompareMode = () => {
    setIsCompareMode(true);
    setSelectionStep('before');
    setSelectedPhotos({});
    // Resolve signed URLs for all photos when entering compare mode (thumbnails need them)
    fitnessPhotos.forEach((_, i) => resolveSignedUrlsForSlide(i));
  };
  const handlePhotoSelect = (photo: {
    front_photo_url?: string | null;
    side_photo_url?: string | null;
    front_signed_url?: string | null;
    side_signed_url?: string | null;
    week_end_date: string;
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
      <header className="sticky border-b border-border/50 bg-card/50 backdrop-blur-sm top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-2">
            <img src={shapeshiftrLogo} alt="ShapeShiftr" className="h-[45px] w-[45px] sm:h-[50px] sm:w-[50px]" />
            <h1 className="text-lg sm:text-2xl font-bold text-primary">
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
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 animate-slide-up h-full relative rounded-xl" style={{
          animationDelay: "0.2s"
        }}>
            <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
            <div className="relative h-full bg-card rounded-xl">
              <MetricsChart ref={metricsChartRef} />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4 animate-slide-up flex flex-col h-full" style={{
          animationDelay: "0.4s"
        }}>
            <div className="grid grid-cols-1 gap-3 flex-1">
              <div className="relative rounded-xl">
                <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                <div className="fitness-card p-3 text-center relative z-10 bg-card rounded-xl">
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
                  {userGoals.goal_weight && <div className="text-xs text-muted-foreground mt-1">
                      Goal: {userGoals.goal_weight} lbs
                    </div>}
                  <div className="text-xs mt-1 flex items-center justify-center gap-1">
                    {isLoadingStats ? "" : (() => {
                    const changeData = formatChange(fitnessStats?.weight || {
                      current: null,
                      change: null,
                      direction: 'neutral',
                      unit: 'lbs'
                    }, fitnessStats?.comparisonDaysAgo);
                    return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                          {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                          <span>{changeData.text}</span>
                        </div> : null;
                  })()}
                  </div>
                </div>
              </div>
              <div className="relative rounded-xl">
                <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                <div className="fitness-card p-3 text-center relative z-10 bg-card rounded-xl">
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
                  {userGoals.goal_body_fat_percentage && <div className="text-xs text-muted-foreground mt-1">
                      Goal: {userGoals.goal_body_fat_percentage}%
                    </div>}
                  <div className="text-xs mt-1 flex items-center justify-center gap-1">
                    {isLoadingStats ? "" : (() => {
                    const changeData = formatChange(fitnessStats?.bodyFat || {
                      current: null,
                      change: null,
                      direction: 'neutral',
                      unit: '%'
                    }, fitnessStats?.comparisonDaysAgo);
                    return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                          {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                          <span>{changeData.text}</span>
                        </div> : null;
                  })()}
                  </div>
                </div>
              </div>
              <div className="relative rounded-xl">
                <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                <div className="fitness-card p-3 text-center relative z-10 bg-card rounded-xl">
                  <div className="flex items-center justify-center mb-2">
                    <Ruler className="h-5 w-5 text-primary mr-2" />
                    <div className="text-sm text-muted-foreground">Belly Skinfold</div>
                  </div>
                  <div className="metric-value">
                    {isLoadingStats ? "..." : formatCurrentValue(fitnessStats?.skinFold || {
                    current: null,
                    change: null,
                    direction: 'neutral',
                    unit: 'mm'
                  })}
                  </div>
                  {userGoals.goal_skin_fold_mm && <div className="text-xs text-muted-foreground mt-1">
                      Goal: {userGoals.goal_skin_fold_mm}mm
                    </div>}
                  <div className="text-xs mt-1 flex items-center justify-center gap-1">
                    {isLoadingStats ? "" : (() => {
                    const changeData = formatChange(fitnessStats?.skinFold || {
                      current: null,
                      change: null,
                      direction: 'neutral',
                      unit: 'mm'
                    }, fitnessStats?.comparisonDaysAgo);
                    return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                          {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                          <span>{changeData.text}</span>
                        </div> : null;
                  })()}
                  </div>
                </div>
              </div>
              <div className="relative rounded-xl">
                <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                <div className="fitness-card p-3 text-center relative z-10 bg-card rounded-xl">
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
                  {userGoals.goal_avg_exercise_min_per_day && <div className="text-xs text-muted-foreground mt-1">
                      Goal: {userGoals.goal_avg_exercise_min_per_day} min
                    </div>}
                  <div className="text-xs mt-1 flex items-center justify-center gap-1">
                    {isLoadingStats ? "" : (() => {
                    const changeData = formatChange(fitnessStats?.exercise || {
                      current: null,
                      change: null,
                      direction: 'neutral',
                      unit: 'min'
                    }, fitnessStats?.comparisonDaysAgo);
                    return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                          {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                          <span>{changeData.text}</span>
                        </div> : null;
                  })()}
                  </div>
                </div>
              </div>
              <div className="relative rounded-xl">
                <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                <div className="fitness-card p-3 text-center relative z-10 bg-card rounded-xl">
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
                  {userGoals.goal_avg_daily_calories && <div className="text-xs text-muted-foreground mt-1">
                      Goal: {userGoals.goal_avg_daily_calories.toLocaleString()} cal
                    </div>}
                  <div className="text-xs mt-1 flex items-center justify-center gap-1">
                    {isLoadingStats ? "" : (() => {
                    const changeData = formatChange(fitnessStats?.calories || {
                      current: null,
                      change: null,
                      direction: 'neutral',
                      unit: 'cal'
                    }, fitnessStats?.comparisonDaysAgo);
                    return changeData.text ? <div className={`flex items-center gap-1 ${changeData.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {changeData.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                          {changeData.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                          <span>{changeData.text}</span>
                        </div> : null;
                  })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Progress Analysis Section */}
        <section className="animate-slide-up relative rounded-xl" style={{
        animationDelay: "0.5s"
      }}>
          <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
          <div className="relative z-10 bg-card rounded-xl">
            <ProgressAnalysis stats={fitnessStats} goals={userGoals} goalsLoaded={goalsLoaded} />
          </div>
        </section>

        {/* Progress Photos Section */}
        <section className="animate-slide-up relative rounded-xl" style={{
        animationDelay: "0.6s"
      }}>
          <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
          <div className="fitness-card p-6 relative z-10 bg-card rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-semibold text-primary">
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
                            {(entry.front_signed_url || entry.front_photo_url) && <img src={entry.front_signed_url || entry.front_photo_url || ''} alt={`Front view - ${entry.week_end_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" loading="lazy" />}
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-center">Side View</h4>
                            {(entry.side_signed_url || entry.side_photo_url) && <img src={entry.side_signed_url || entry.side_photo_url || ''} alt={`Side view - ${entry.week_end_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" loading="lazy" />}
                          </div>
                        </div>
                        <p className="text-center text-sm text-muted-foreground mt-2">
                          Week ending {(() => {
                    const [year, month, day] = entry.week_end_date.split('-').map(Number);
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
                  {/* Front Views Comparison */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-center">Front View Comparison</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-center text-primary">Before</h5>
                        {(selectedPhotos.before.front_signed_url || selectedPhotos.before.front_photo_url) && <img src={selectedPhotos.before.front_signed_url || selectedPhotos.before.front_photo_url || ''} alt={`Before front - ${selectedPhotos.before.week_end_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                        <p className="text-center text-xs text-muted-foreground">
                          {(() => {
                      const [year, month, day] = selectedPhotos.before.week_end_date.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-center text-secondary">After</h5>
                        {(selectedPhotos.after.front_signed_url || selectedPhotos.after.front_photo_url) && <img src={selectedPhotos.after.front_signed_url || selectedPhotos.after.front_photo_url || ''} alt={`After front - ${selectedPhotos.after.week_end_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                        <p className="text-center text-xs text-muted-foreground">
                          {(() => {
                      const [year, month, day] = selectedPhotos.after.week_end_date.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Side Views Comparison */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-center">Side View Comparison</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-center text-primary">Before</h5>
                        {(selectedPhotos.before.side_signed_url || selectedPhotos.before.side_photo_url) && <img src={selectedPhotos.before.side_signed_url || selectedPhotos.before.side_photo_url || ''} alt={`Before side - ${selectedPhotos.before.week_end_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                        <p className="text-center text-xs text-muted-foreground">
                          {(() => {
                      const [year, month, day] = selectedPhotos.before.week_end_date.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-center text-secondary">After</h5>
                        {(selectedPhotos.after.side_signed_url || selectedPhotos.after.side_photo_url) && <img src={selectedPhotos.after.side_signed_url || selectedPhotos.after.side_photo_url || ''} alt={`After side - ${selectedPhotos.after.week_end_date}`} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                        <p className="text-center text-xs text-muted-foreground">
                          {(() => {
                      const [year, month, day] = selectedPhotos.after.week_end_date.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}
                        </p>
                      </div>
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
                            {(entry.front_signed_url || entry.front_photo_url) && <img src={entry.front_signed_url || entry.front_photo_url || ''} alt={`Front - ${entry.week_end_date}`} className="w-full aspect-[9/16] object-cover rounded" loading="lazy" />}
                          </div>
                          <div className="space-y-1">
                            <h5 className="text-xs font-medium text-center">Side</h5>
                            {(entry.side_signed_url || entry.side_photo_url) && <img src={entry.side_signed_url || entry.side_photo_url || ''} alt={`Side - ${entry.week_end_date}`} className="w-full aspect-[9/16] object-cover rounded" loading="lazy" />}
                          </div>
                        </div>
                        <p className="text-center text-xs text-muted-foreground mt-1">
                          Week ending {(() => {
                    const [year, month, day] = entry.week_end_date.split('-').map(Number);
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
        <section className="animate-slide-up relative rounded-xl" style={{
        animationDelay: "0.8s"
      }}>
          <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
          <div className="relative z-10 bg-card rounded-xl">
            <FitnessAffirmations ref={fitnessAffirmationsRef} onOpenAffirmations={() => setShowAffirmationsManager(true)} />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 animate-slide-up" style={{
        animationDelay: "1s"
      }}>
          <p className="text-muted-foreground text-sm">
            <a
              href="https://github.com/justinsantistevan/shapeshiftr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              https://github.com/justinsantistevan/shapeshiftr
            </a>
          </p>
        </footer>
      </main>

      <AddDataForm open={showAddDataForm} onOpenChange={setShowAddDataForm} onSuccess={handleDataAdded} />
      
      <GoalsForm open={showGoalsForm} onOpenChange={setShowGoalsForm} onGoalsUpdated={handleGoalsUpdated} />

      <Dialog open={showAffirmationsManager} onOpenChange={setShowAffirmationsManager}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto my-0 py-[35px]">
          <DialogHeader>
            <DialogTitle>Manage Affirmations</DialogTitle>
            <DialogDescription>Add, edit, reorder, or delete your personal affirmations to keep you motivated on your fitness journey.</DialogDescription>
          </DialogHeader>
          <AffirmationsManager onAffirmationsChange={() => {
          // Refresh the affirmations display at the bottom of the page
          fitnessAffirmationsRef.current?.refreshAffirmations();
        }} />
        </DialogContent>
      </Dialog>
    </div>;
}