/*
  # Create insights table for FlowSense

  1. New Tables
    - `insights`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, not null)
      - `title` (text, not null)
      - `body` (text, not null)
      - `type` (text) - 'spending', 'saving', 'warning', 'tip'
      - `is_read` (boolean, default false)
      - `created_at` (timestamp with timezone, default now())

  2. Security
    - Enable RLS on `insights` table
    - Users can only access their own insights
*/

CREATE TABLE IF NOT EXISTS insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text DEFAULT 'spending' CHECK (type IN ('spending', 'saving', 'warning', 'tip')),
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read own insights
CREATE POLICY "Users can read own insights"
  ON insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert own insights
CREATE POLICY "Users can insert own insights"
  ON insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update own insights
CREATE POLICY "Users can update own insights"
  ON insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_is_read ON insights(is_read);
