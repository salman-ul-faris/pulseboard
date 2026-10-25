-- PulseBoard Migration: Add Profile Picture Support
-- Backward-compatible addition of avatar fields to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key VARCHAR(255);
