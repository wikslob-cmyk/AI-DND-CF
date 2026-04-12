-- Clean up any existing duplicates (keep lowest id)
DELETE FROM liability
WHERE id NOT IN (
  SELECT MIN(id) FROM liability GROUP BY entity_code, name
);

-- Add unique constraint to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_liability_entity_name'
  ) THEN
    ALTER TABLE liability ADD CONSTRAINT uq_liability_entity_name UNIQUE (entity_code, name);
  END IF;
END $$;
