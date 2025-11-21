-- Make fitness-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'fitness-photos';

-- Drop existing policies if they exist for fitness-photos
DROP POLICY IF EXISTS "Users can view their own fitness photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own fitness photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own fitness photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own fitness photos" ON storage.objects;

-- Allow authenticated users to view only their own fitness photos
CREATE POLICY "Users can view their own fitness photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fitness-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to upload their own fitness photos
CREATE POLICY "Users can upload their own fitness photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fitness-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own fitness photos
CREATE POLICY "Users can update their own fitness photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fitness-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own fitness photos
CREATE POLICY "Users can delete their own fitness photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fitness-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);