/*
# Document intentional public RLS policies (single-tenant, no auth)

## Background
This is a single-tenant survey/checklist app with NO sign-in screen and NO
user_id columns on any table. The frontend talks to Supabase with the anon
key for its entire lifetime, so every policy MUST list `anon` (alongside
`authenticated`) or the app would see empty tables.

## Why USING (true) / WITH CHECK (true) is correct here
The data in surveys, questions, responses, answers, departments, and
workstations is intentionally shared/public across all users of the app.
There is no per-user ownership concept in the schema (no user_id columns,
no auth flow). Therefore the only correct access predicate is `true` —
every anon/authenticated client may read and write all rows.

Restricting to `authenticated`-only would break the app: the anon-key
frontend has auth.uid() = null, so an authenticated-only policy would
return zero rows and the app would appear empty/broken.

## Changes
Recreates all existing CRUD policies on the six tables with the SAME
access semantics (anon + authenticated, predicate true) but adds a
documenting comment to each policy so the intentional-public-access
decision is recorded inline. No access semantics change — this is a
no-op from the perspective of any running query.

## Tables affected
- surveys
- questions
- responses
- answers
- departments
- workstations

## Security
RLS remains ENABLED on every table. Policies remain scoped to
`TO anon, authenticated`. The `true` predicate is documented as
intentional public/shared data for a no-auth single-tenant app.
*/

-- ============ surveys ============
DROP POLICY IF EXISTS "anon_select_surveys" ON surveys;
CREATE POLICY "anon_select_surveys" ON surveys FOR SELECT
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_insert_surveys" ON surveys;
CREATE POLICY "anon_insert_surveys" ON surveys FOR INSERT
  TO anon, authenticated WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_update_surveys" ON surveys;
CREATE POLICY "anon_update_surveys" ON surveys FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_delete_surveys" ON surveys;
CREATE POLICY "anon_delete_surveys" ON surveys FOR DELETE
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

-- ============ questions ============
DROP POLICY IF EXISTS "anon_select_questions" ON questions;
CREATE POLICY "anon_select_questions" ON questions FOR SELECT
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_insert_questions" ON questions;
CREATE POLICY "anon_insert_questions" ON questions FOR INSERT
  TO anon, authenticated WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_update_questions" ON questions;
CREATE POLICY "anon_update_questions" ON questions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_delete_questions" ON questions;
CREATE POLICY "anon_delete_questions" ON questions FOR DELETE
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

-- ============ responses ============
DROP POLICY IF EXISTS "anon_select_responses" ON responses;
CREATE POLICY "anon_select_responses" ON responses FOR SELECT
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_insert_responses" ON responses;
CREATE POLICY "anon_insert_responses" ON responses FOR INSERT
  TO anon, authenticated WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_update_responses" ON responses;
CREATE POLICY "anon_update_responses" ON responses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_delete_responses" ON responses;
CREATE POLICY "anon_delete_responses" ON responses FOR DELETE
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

-- ============ answers ============
DROP POLICY IF EXISTS "anon_select_answers" ON answers;
CREATE POLICY "anon_select_answers" ON answers FOR SELECT
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_insert_answers" ON answers;
CREATE POLICY "anon_insert_answers" ON answers FOR INSERT
  TO anon, authenticated WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_update_answers" ON answers;
CREATE POLICY "anon_update_answers" ON answers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "anon_delete_answers" ON answers;
CREATE POLICY "anon_delete_answers" ON answers FOR DELETE
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

-- ============ departments ============
DROP POLICY IF EXISTS "select_departments" ON departments;
CREATE POLICY "select_departments" ON departments FOR SELECT
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "insert_departments" ON departments;
CREATE POLICY "insert_departments" ON departments FOR INSERT
  TO anon, authenticated WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "update_departments" ON departments;
CREATE POLICY "update_departments" ON departments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "delete_departments" ON departments;
CREATE POLICY "delete_departments" ON departments FOR DELETE
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

-- ============ workstations ============
DROP POLICY IF EXISTS "select_workstations" ON workstations;
CREATE POLICY "select_workstations" ON workstations FOR SELECT
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "insert_workstations" ON workstations;
CREATE POLICY "insert_workstations" ON workstations FOR INSERT
  TO anon, authenticated WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "update_workstations" ON workstations;
CREATE POLICY "update_workstations" ON workstations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true); -- intentional: public/shared, no-auth single-tenant app

DROP POLICY IF EXISTS "delete_workstations" ON workstations;
CREATE POLICY "delete_workstations" ON workstations FOR DELETE
  TO anon, authenticated USING (true); -- intentional: public/shared, no-auth single-tenant app
