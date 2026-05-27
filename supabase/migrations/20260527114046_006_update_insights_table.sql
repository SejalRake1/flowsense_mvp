/*
  # Update insights table for FlowSense

  1. Changes
    - Add `dismissed_at` column (timestamp with timezone, nullable)
    - Update `type` constraint to include all insight types
    - Add index on dismissed_at for filtering

  2. Notes
    - dismissed_at is set when user dismisses an insight
    - Insights with dismissed_at not null are hidden from the list
*/

-- Add dismissed_at column
ALTER TABLE insights 
ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- Update type constraint
ALTER TABLE insights 
DROP CONSTRAINT IF EXISTS insights_type_check;

ALTER TABLE insights 
ADD CONSTRAINT insights_type_check 
CHECK (type IN ('spike', 'pattern', 'subscription', 'anomaly', 'weekly_summary', 'spending', 'saving', 'warning', 'tip'));

-- Add index
CREATE INDEX IF NOT EXISTS idx_insights_dismissed_at ON insights(dismissed_at);
