-- Add workstation column to responses table
ALTER TABLE responses ADD COLUMN IF NOT EXISTS workstation text;