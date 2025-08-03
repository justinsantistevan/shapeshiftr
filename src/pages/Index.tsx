import { useState, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { AuthForm } from "@/components/AuthForm";
import { Dashboard } from "@/pages/Dashboard";
import { supabase } from "@/lib/mockSupabase";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {isAuthenticated ? (
        <Dashboard onSignOut={() => setIsAuthenticated(false)} />
      ) : (
        <AuthForm onAuthSuccess={() => setIsAuthenticated(true)} />
      )}
    </ThemeProvider>
  );
};

export default Index;
