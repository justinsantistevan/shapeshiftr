-- Create storage bucket for fitness photos
INSERT INTO storage.buckets (id, name, public) VALUES ('fitness-photos', 'fitness-photos', true);

-- Create policies for fitness photos storage
CREATE POLICY "Users can view their own fitness photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'fitness-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own fitness photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'fitness-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own fitness photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'fitness-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own fitness photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'fitness-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add photo columns to weekly_fitness_entries table
ALTER TABLE public.weekly_fitness_entries
ADD COLUMN front_photo_url text,
ADD COLUMN side_photo_url text;