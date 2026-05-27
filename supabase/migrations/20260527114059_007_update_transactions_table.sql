/*
  # Update transactions table for FlowSense

  1. Changes
    - Add `upi_ref_id` column for UPI transaction reference

  2. Notes
    - upi_ref_id stores the bank/UPI transaction ID for reference
*/

-- Add upi_ref_id column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS upi_ref_id text;

CREATE INDEX IF NOT EXISTS idx_transactions_upi_ref_id ON transactions(upi_ref_id);
