-- Drop existing policies
DROP POLICY IF EXISTS insert_departments ON departments;
DROP POLICY IF EXISTS update_departments ON departments;
DROP POLICY IF EXISTS delete_departments ON departments;

-- Recreate policies to allow anon (since we're using anon key)
CREATE POLICY "insert_departments" ON departments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_departments" ON departments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_departments" ON departments FOR DELETE
  TO anon, authenticated USING (true);