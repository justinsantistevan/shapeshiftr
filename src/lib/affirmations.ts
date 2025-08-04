import { supabase } from "@/integrations/supabase/client";

export interface Affirmation {
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_AFFIRMATIONS = [
  "I can do hard things.",
  "I am disciplined.", 
  "I have pain-free flexibility in my shoulder.",
  "My knee gets stronger every day.",
  "I enjoy working hard during workouts.",
  "I choose long term goals over short term gratification.",
  "If we overestimate what we can accomplish in a month, we underestimate what we can achieve in 6 months."
];

// Fetch user's affirmations, create defaults if none exist
export async function fetchUserAffirmations(): Promise<Affirmation[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: affirmations, error } = await supabase
      .from('user_affirmations')
      .select('id, text, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // If user has no affirmations, create defaults
    if (!affirmations || affirmations.length === 0) {
      await createDefaultAffirmations();
      // Fetch again after creating defaults
      const { data: newAffirmations, error: fetchError } = await supabase
        .from('user_affirmations')
        .select('id, text, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      if (fetchError) throw fetchError;
      return newAffirmations || [];
    }

    return affirmations;
  } catch (error) {
    console.error('Error fetching affirmations:', error);
    return [];
  }
}

// Create default affirmations for new users
async function createDefaultAffirmations(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const defaultEntries = DEFAULT_AFFIRMATIONS.map(text => ({
      user_id: user.id,
      text
    }));

    const { error } = await supabase
      .from('user_affirmations')
      .insert(defaultEntries);

    if (error) throw error;
  } catch (error) {
    console.error('Error creating default affirmations:', error);
  }
}

// Add a new affirmation
export async function addAffirmation(text: string): Promise<Affirmation | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_affirmations')
      .insert({
        user_id: user.id,
        text: text.trim()
      })
      .select('id, text, created_at, updated_at')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding affirmation:', error);
    return null;
  }
}

// Update an existing affirmation
export async function updateAffirmation(id: string, text: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_affirmations')
      .update({ text: text.trim() })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating affirmation:', error);
    return false;
  }
}

// Delete an affirmation
export async function deleteAffirmation(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_affirmations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting affirmation:', error);
    return false;
  }
}