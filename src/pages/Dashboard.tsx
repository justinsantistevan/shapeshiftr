import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InspirationalQuote } from "@/components/InspirationalQuote";
import { MetricsChart } from "@/components/MetricsChart";
import { FitnessAffirmations } from "@/components/FitnessAffirmations";
import { supabase } from "@/lib/mockSupabase";
import { useToast } from "@/hooks/use-toast";
import shapeshiftrLogo from "@/assets/shapeshiftr-logo.png";

interface DashboardProps {
  onSignOut: () => void;
}

export function Dashboard({ onSignOut }: DashboardProps) {
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
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Data
            </Button>
            <Button variant="outline" size="sm">
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
            <div className="text-center text-muted-foreground py-12">
              <p>Photo carousel will be implemented once you start uploading weekly progress photos.</p>
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Upload Photos
              </Button>
            </div>
          </div>
        </section>

        {/* Affirmations */}
        <section className="animate-slide-up" style={{ animationDelay: "0.8s" }}>
          <FitnessAffirmations />
        </section>
      </main>
    </div>
  );
}