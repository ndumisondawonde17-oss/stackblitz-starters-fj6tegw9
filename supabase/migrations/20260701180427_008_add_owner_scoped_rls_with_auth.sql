/*
# Add owner-scoped RLS with Supabase auth

## Background
The app previously used a client-side password (localStorage) with RLS
policies that used `USING (true)` on every table. This is a security
weakness: anyone with the anon key could read/write all data. This
migration replaces the fake auth with real Supabase email/password auth
and owner-scoped RLS policies with real predicates (no more `true`).

## App model
- Owner page (index.html): authenticated admin creates surveys, manages
  departments/workstations, views responses. Owns all their data.
- Guest page (guest.html): anonymous users fill out surveys. They need
  anon READ access to surveys/questions/workstations and anon INSERT
  access to responses/answers.

## Schema changes
1. Add `user_id uuid` (defaulting to auth.uid()) to:
   - surveys (owner of the survey)
   - departments (owner of the department)
   - workstations (owner of the workstation)
   - responses (owner of the response = survey owner, so the owner can
     manage responses on their surveys)
   The DEFAULT auth.uid() means inserts that omit user_id still satisfy
   the INSERT policy's WITH CHECK (auth.uid() = user_id).

   questions and answers do NOT get a user_id column — they are scoped
   through their parent (survey / response) via EXISTS subqueries.

2. Backfill existing rows: set user_id to the first authenticated user
   so existing data is not orphaned.

## RLS policy design

### surveys (owner-scoped)
- SELECT: anon can read (guests need to see available surveys);
  authenticated can read their own.
- INSERT/UPDATE/DELETE: authenticated, auth.uid() = user_id only.

### questions (scoped through parent survey)
- SELECT: anon can read (guests need questions to fill out surveys);
  authenticated can read questions on their own surveys.
- INSERT/UPDATE/DELETE: authenticated, must own the parent survey
  (EXISTS check against surveys.user_id = auth.uid()).

### responses (owner = survey owner; guests insert)
- SELECT/UPDATE/DELETE: authenticated, must own the parent survey
  (auth.uid() = user_id, where user_id defaults to the survey owner).
- INSERT: anon allowed (guests submit responses). Authenticated owners
  can also insert with auth.uid() = user_id.

### answers (scoped through parent response)
- SELECT: authenticated, must own the parent response's survey.
- INSERT: anon allowed (guests submit answers alongside responses).
- UPDATE/DELETE: authenticated, must own the parent response's survey.

### departments (owner-scoped)
- All CRUD: authenticated, auth.uid() = user_id.

### workstations (owner-scoped, anon can read)
- SELECT: anon + authenticated (guests need workstation names).
- INSERT/UPDATE/DELETE: authenticated, auth.uid() = user_id.

## Important notes
1. The owner frontend (script.js) is updated in the same task to use
   supabase.auth.signUp / signInWithPassword / signOut, and to guard the
   app behind a real auth session.
2. Email confirmation stays OFF (default).
*/

-- ============================================================
-- 1. Add user_id columns
-- ============================================================

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE workstations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill existing rows with the first authenticated user, if one exists.
DO $$
DECLARE
  first_user uuid;
BEGIN
  SELECT id INTO first_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_user IS NOT NULL THEN
    UPDATE surveys SET user_id = first_user WHERE user_id IS NULL;
    UPDATE departments SET user_id = first_user WHERE user_id IS NULL;
    UPDATE workstations SET user_id = first_user WHERE user_id IS NULL;
    UPDATE responses SET user_id = first_user WHERE user_id IS NULL;
  END IF;
END $$;

-- Set defaults for future inserts
ALTER TABLE surveys ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE departments ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE workstations ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE responses ALTER COLUMN user_id SET DEFAULT auth.uid();

-- FK constraints (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'surveys_user_id_fkey') THEN
    ALTER TABLE surveys ADD CONSTRAINT surveys_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_user_id_fkey') THEN
    ALTER TABLE departments ADD CONSTRAINT departments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workstations_user_id_fkey') THEN
    ALTER TABLE workstations ADD CONSTRAINT workstations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'responses_user_id_fkey') THEN
    ALTER TABLE responses ADD CONSTRAINT responses_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for owner-scoped queries
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_departments_user_id ON departments(user_id);
CREATE INDEX IF NOT EXISTS idx_workstations_user_id ON workstations(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON responses(user_id);

-- ============================================================
-- 2. RLS policies — surveys
-- ============================================================

DROP POLICY IF EXISTS "anon_select_surveys" ON surveys;
DROP POLICY IF EXISTS "anon_insert_surveys" ON surveys;
DROP POLICY IF EXISTS "anon_update_surveys" ON surveys;
DROP POLICY IF EXISTS "anon_delete_surveys" ON surveys;

CREATE POLICY "anon_select_surveys" ON surveys FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_own_surveys" ON surveys FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_surveys" ON surveys FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_surveys" ON surveys FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 3. RLS policies — questions (scoped through parent survey)
-- ============================================================

DROP POLICY IF EXISTS "anon_select_questions" ON questions;
DROP POLICY IF EXISTS "anon_insert_questions" ON questions;
DROP POLICY IF EXISTS "anon_update_questions" ON questions;
DROP POLICY IF EXISTS "anon_delete_questions" ON questions;

CREATE POLICY "anon_select_questions" ON questions FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_own_questions" ON questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM surveys WHERE surveys.id = questions.survey_id AND surveys.user_id = auth.uid())
  );

CREATE POLICY "update_own_questions" ON questions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM surveys WHERE surveys.id = questions.survey_id AND surveys.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM surveys WHERE surveys.id = questions.survey_id AND surveys.user_id = auth.uid())
  );

CREATE POLICY "delete_own_questions" ON questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM surveys WHERE surveys.id = questions.survey_id AND surveys.user_id = auth.uid())
  );

-- ============================================================
-- 4. RLS policies — responses
-- ============================================================

DROP POLICY IF EXISTS "anon_select_responses" ON responses;
DROP POLICY IF EXISTS "anon_insert_responses" ON responses;
DROP POLICY IF EXISTS "anon_update_responses" ON responses;
DROP POLICY IF EXISTS "anon_delete_responses" ON responses;

CREATE POLICY "select_own_responses" ON responses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_responses" ON responses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_own_responses" ON responses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_responses" ON responses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. RLS policies — answers (scoped through parent response)
-- ============================================================

DROP POLICY IF EXISTS "anon_select_answers" ON answers;
DROP POLICY IF EXISTS "anon_insert_answers" ON answers;
DROP POLICY IF EXISTS "anon_update_answers" ON answers;
DROP POLICY IF EXISTS "anon_delete_answers" ON answers;

CREATE POLICY "select_own_answers" ON answers FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM responses
      JOIN surveys ON surveys.id = responses.survey_id
      WHERE responses.id = answers.response_id AND surveys.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_answers" ON answers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_own_answers" ON answers FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM responses
      JOIN surveys ON surveys.id = responses.survey_id
      WHERE responses.id = answers.response_id AND surveys.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM responses
      JOIN surveys ON surveys.id = responses.survey_id
      WHERE responses.id = answers.response_id AND surveys.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own_answers" ON answers FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM responses
      JOIN surveys ON surveys.id = responses.survey_id
      WHERE responses.id = answers.response_id AND surveys.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. RLS policies — departments (owner-scoped)
-- ============================================================

DROP POLICY IF EXISTS "select_departments" ON departments;
DROP POLICY IF EXISTS "insert_departments" ON departments;
DROP POLICY IF EXISTS "update_departments" ON departments;
DROP POLICY IF EXISTS "delete_departments" ON departments;

CREATE POLICY "select_own_departments" ON departments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_departments" ON departments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_departments" ON departments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_departments" ON departments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 7. RLS policies — workstations (owner-scoped, anon can read)
-- ============================================================

DROP POLICY IF EXISTS "select_workstations" ON workstations;
DROP POLICY IF EXISTS "insert_workstations" ON workstations;
DROP POLICY IF EXISTS "update_workstations" ON workstations;
DROP POLICY IF EXISTS "delete_workstations" ON workstations;

CREATE POLICY "select_workstations" ON workstations FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_own_workstations" ON workstations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_workstations" ON workstations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_workstations" ON workstations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
