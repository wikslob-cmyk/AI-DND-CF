-- Manual entries: receivables/payables outside of Saldeo
CREATE TABLE IF NOT EXISTS manual_entry (
  id SERIAL PRIMARY KEY,
  entity_code VARCHAR(10) NOT NULL REFERENCES entity(code),
  name VARCHAR(500) NOT NULL,
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('receivable', 'payable')),
  gross_value NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_entry_entity_type ON manual_entry (entity_code, entry_type);
