-- Add surname and signature columns to responses table
ALTER TABLE responses ADD COLUMN IF NOT EXISTS surname text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS signature text;