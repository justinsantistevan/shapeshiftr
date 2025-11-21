-- Create user_affirmations table
CREATE TABLE public.user_affirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  text text NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_affirmations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own affirmations" 
ON public.user_affirmations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own affirmations" 
ON public.user_affirmations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own affirmations" 
ON public.user_affirmations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own affirmations" 
ON public.user_affirmations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_affirmations_updated_at
BEFORE UPDATE ON public.user_affirmations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default affirmations for existing users (optional)
-- Note: This will only work for users who are currently authenticated, 
-- so we'll handle default affirmations in the application code instead