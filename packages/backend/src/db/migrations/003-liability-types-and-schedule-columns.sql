-- Expand liability type enum to support new categories
ALTER TABLE liability DROP CONSTRAINT IF EXISTS liability_type_check;
ALTER TABLE liability ADD CONSTRAINT liability_type_check
  CHECK (type IN ('credit', 'loan', 'leasing_financial', 'leasing_operational', 'limit', 'factoring', 'info', 'leasing'));

-- Add columns for operational leasing schedules
ALTER TABLE liability_schedule
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_fees NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Migrate old 'leasing' type to 'leasing_financial' as default
-- Users can change individual ones to 'leasing_operational' via UI
UPDATE liability SET type = 'leasing_financial' WHERE type = 'leasing';

-- Now tighten the constraint (remove old 'leasing')
ALTER TABLE liability DROP CONSTRAINT liability_type_check;
ALTER TABLE liability ADD CONSTRAINT liability_type_check
  CHECK (type IN ('credit', 'loan', 'leasing_financial', 'leasing_operational', 'limit', 'factoring', 'info'));
