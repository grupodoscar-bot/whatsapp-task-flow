-- Fix broken time_entries RLS policies
-- The current policies have a bug: WHERE id = user_id which compares profiles.id with profiles.user_id (always false)
-- This prevents users from creating, updating, or deleting their time entries

-- Drop the broken policies
DROP POLICY IF EXISTS "Users can create their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can delete their own time entries" ON time_entries;

-- Create correct policies that check if the time_entry belongs to the authenticated user
CREATE POLICY "Users can create their own time entries" 
ON time_entries FOR INSERT 
WITH CHECK (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own time entries" 
ON time_entries FOR UPDATE 
USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their own time entries" 
ON time_entries FOR DELETE 
USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);