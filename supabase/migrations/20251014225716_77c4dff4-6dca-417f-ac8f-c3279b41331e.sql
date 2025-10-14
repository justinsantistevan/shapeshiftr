-- Security Fix 1: Remove overly permissive SELECT policy on coach_prompt_versions
-- This prevents authenticated users from accessing proprietary AI coaching prompts
DROP POLICY IF EXISTS "Authenticated users can view prompt versions" ON coach_prompt_versions;

-- Security Fix 2: Add DELETE policy for coach_chat_logs
-- Allows users to delete their own chat history
CREATE POLICY "Users can delete their own chat logs" 
ON coach_chat_logs 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);