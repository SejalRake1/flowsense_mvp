/*
  # Create alerts table for FlowSense

  1. New Tables
    - `alerts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, not null)
      - `title` (text, not null)
      - `message` (text, not null)
      - `type` (text) - 'info', 'warning', 'success', 'error'
      - `is_read` (boolean, default false)
      - `created_at` (timestamp with timezone, default now())

  2. Security
    - Enable RLS on `alerts` table
    - Users can only access their own alerts
*/

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read own alerts
CREATE POLICY "Users can read own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert own alerts
CREATE POLICY "Users can insert own alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update own alerts
CREATE POLICY "Users can update own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
