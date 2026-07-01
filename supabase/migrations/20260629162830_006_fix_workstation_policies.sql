-- Drop existing policies for workstations
DROP POLICY IF EXISTS insert_workstations ON workstations;
DROP POLICY IF EXISTS update_workstations ON workstations;
DROP POLICY IF EXISTS delete_workstations ON workstations;

-- Recreate policies to allow anon
CREATE POLICY "insert_workstations" ON workstations FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_workstations" ON workstations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_workstations" ON workstations FOR DELETE
  TO anon, authenticated USING (true);