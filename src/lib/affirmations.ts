import { supabase } from "@/integrations/supabase/client";

export interface Affirmation {
  id: string;
  text: string;
  display_order: number;
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
    if (!user) {
      console.log('No authenticated user found');
      return [];
    }

    console.log('Fetching affirmations for user:', user.id);

    const { data: affirmations, error } = await supabase
      .from('user_affirmations')
      .select('id, text, display_order, created_at, updated_at')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching user affirmations:', error);
      throw error;
    }

    console.log('Found affirmations:', affirmations?.length || 0);

    // If user has no affirmations, create defaults
    if (!affirmations || affirmations.length === 0) {
      console.log('No affirmations found, creating defaults for user:', user.id);
      await createDefaultAffirmations();
      // Fetch again after creating defaults
      const { data: newAffirmations, error: fetchError } = await supabase
        .from('user_affirmations')
        .select('id, text, display_order, created_at, updated_at')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true });
      
      if (fetchError) {
        console.error('Error fetching new affirmations:', fetchError);
        throw fetchError;
      }
      console.log('Created default affirmations:', newAffirmations?.length || 0);
      return newAffirmations || [];
    }

    return affirmations;
  } catch (error) {
    console.error('Error in fetchUserAffirmations:', error);
    return [];
  }
}

// Create default affirmations for new users
async function createDefaultAffirmations(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user already has any affirmations to prevent duplicates
    const { data: existingAffirmations } = await supabase
      .from('user_affirmations')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (existingAffirmations && existingAffirmations.length > 0) {
      console.log('User already has affirmations, skipping default creation');
      return;
    }

    const defaultEntries = DEFAULT_AFFIRMATIONS.map((text, index) => ({
      user_id: user.id,
      text,
      display_order: index + 1
    }));

    const { error } = await supabase
      .from('user_affirmations')
      .insert(defaultEntries);

    if (error) throw error;
    console.log('Successfully created default affirmations for user:', user.id);
  } catch (error) {
    console.error('Error creating default affirmations:', error);
  }
}

// Add a new affirmation
export async function addAffirmation(text: string): Promise<Affirmation | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get the next order position (highest + 1)
    const { data: lastAffirmation } = await supabase
      .from('user_affirmations')
      .select('display_order')
      .eq('user_id', user.id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = lastAffirmation && lastAffirmation.length > 0 
      ? lastAffirmation[0].display_order + 1 
      : 1;

    const { data, error } = await supabase
      .from('user_affirmations')
      .insert({
        user_id: user.id,
        text: text.trim(),
        display_order: nextOrder
      })
      .select('id, text, display_order, created_at, updated_at')
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

// Reorder affirmations
export async function reorderAffirmations(affirmations: Affirmation[]): Promise<boolean> {
  try {
    // Update all affirmations with new order
    const updates = affirmations.map((affirmation, index) => ({
      id: affirmation.id,
      display_order: index + 1
    }));

    // Use Promise.all to update all affirmations concurrently
    const updatePromises = updates.map(update =>
      supabase
        .from('user_affirmations')
        .update({ display_order: update.display_order })
        .eq('id', update.id)
    );

    const results = await Promise.all(updatePromises);
    
    // Check if any updates failed
    const hasError = results.some(result => result.error);
    if (hasError) {
      console.error('Some affirmation reorder updates failed');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error reordering affirmations:', error);
    return false;
  }
}