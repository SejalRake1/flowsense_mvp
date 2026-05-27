/*
  # Add data_deletion_requested column to users table

  1. Changes
    - Add `data_deletion_requested` column (boolean, default false)

  2. Notes
    - When set to true, indicates user requested data deletion
*/

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS data_deletion_requested boolean DEFAULT false NOT NULL;
