/*
  # Create transactions table for FlowSense

  1. New Tables
    - `transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, not null)
      - `amount` (decimal, not null)
      - `type` (text, not null) - 'debit' or 'credit'
      - `merchant_raw` (text) - original merchant name from SMS
      - `merchant_normalized` (text) - cleaned merchant name
      - `category` (text, not null) - one of: food, shopping, transport, bills, entertainment, recharge, travel, transfers, subscriptions, others
      - `payment_method` (text) - 'upi', 'card', 'netbanking', 'wallet'
      - `transaction_id` (text, unique) - bank/UPI reference ID
      - `transacted_at` (timestamp with timezone, not null)
      - `created_at` (timestamp with timezone, default now())

  2. Security
    - Enable RLS on `transactions` table
    - Users can only access their own transactions

  3. Indexes
    - Index on user_id for faster queries
    - Index on transacted_at for date filtering
    - Index on category for category filtering
*/

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('debit', 'credit')),
  merchant_raw text,
  merchant_normalized text,
  category text NOT NULL DEFAULT 'others' CHECK (category IN ('food', 'shopping', 'transport', 'bills', 'entertainment', 'recharge', 'travel', 'transfers', 'subscriptions', 'others')),
  payment_method text,
  transaction_id text UNIQUE,
  transacted_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read own transactions
CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert own transactions
CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update own transactions
CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete own transactions
CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transacted_at ON transactions(transacted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
