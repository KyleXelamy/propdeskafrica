-- Add is_pinned column to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Create an index for better query performance when filtering by is_pinned
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned DESC, created_at DESC);
