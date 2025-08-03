// Temporary mock for Supabase until integration is fully configured
export const supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: (callback: (event: string, session: any) => void) => ({
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    }),
    signInWithPassword: ({ email, password }: { email: string; password: string }) => {
      // Mock authentication - replace with real Supabase once configured
      if (email && password) {
        return Promise.resolve({ error: null, data: { user: { email } } });
      }
      return Promise.resolve({ error: { message: "Invalid credentials" } });
    },
    signOut: () => Promise.resolve({ error: null })
  }
};