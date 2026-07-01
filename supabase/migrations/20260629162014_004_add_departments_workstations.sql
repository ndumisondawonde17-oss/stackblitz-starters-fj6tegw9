-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create workstations table
CREATE TABLE IF NOT EXISTS workstations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Add assignment fields to surveys table
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS assigned_departments text[] DEFAULT '{}';
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS assigned_workstations text[] DEFAULT '{}';

-- Enable RLS on new tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstations ENABLE ROW LEVEL SECURITY;

-- RLS policies for departments (public read for anon, authenticated)
CREATE POLICY "select_departments" ON departments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_departments" ON departments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_departments" ON departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_departments" ON departments FOR DELETE TO authenticated USING (true);

-- RLS policies for workstations (public read for anon, authenticated)
CREATE POLICY "select_workstations" ON workstations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_workstations" ON workstations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_workstations" ON workstations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_workstations" ON workstations FOR DELETE TO authenticated USING (true);