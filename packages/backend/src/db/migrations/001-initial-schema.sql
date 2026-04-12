-- Entity table: 5 group companies
CREATE TABLE IF NOT EXISTS entity (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  has_warehouse BOOLEAN NOT NULL DEFAULT FALSE
);

-- Import log: history of data imports
CREATE TABLE IF NOT EXISTS import_log (
  id SERIAL PRIMARY KEY,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  details JSONB NOT NULL DEFAULT '{}'
);

-- Invoice: parsed from Saldeo files
CREATE TABLE IF NOT EXISTS invoice (
  id SERIAL PRIMARY KEY,
  entity_code VARCHAR(10) NOT NULL REFERENCES entity(code),
  document_number VARCHAR(255) NOT NULL,
  document_type VARCHAR(2) NOT NULL CHECK (document_type IN ('FS', 'FZ')),
  contractor_name VARCHAR(500) NOT NULL,
  contractor_nip VARCHAR(20),
  payment_due DATE NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PLN',
  gross_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  partial_payments NUMERIC(15, 2) NOT NULL DEFAULT 0,
  gross_value_pln NUMERIC(15, 2) NOT NULL DEFAULT 0,
  import_id INTEGER REFERENCES import_log(id)
);

-- Exchange rate: NBP rates per import
CREATE TABLE IF NOT EXISTS exchange_rate (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(3) NOT NULL,
  rate_pln NUMERIC(10, 4) NOT NULL,
  rate_date DATE NOT NULL,
  import_id INTEGER REFERENCES import_log(id)
);

-- Liability: financial obligations (credits, leasing, etc.)
CREATE TABLE IF NOT EXISTS liability (
  id SERIAL PRIMARY KEY,
  entity_code VARCHAR(10) NOT NULL REFERENCES entity(code),
  name VARCHAR(500) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('leasing', 'credit', 'limit', 'factoring', 'info')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'pending_write_off', 'informational')),
  original_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  source_file VARCHAR(500),
  config JSONB NOT NULL DEFAULT '{}'
);

-- Liability schedule: monthly installments
CREATE TABLE IF NOT EXISTS liability_schedule (
  id SERIAL PRIMARY KEY,
  liability_id INTEGER NOT NULL REFERENCES liability(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  capital NUMERIC(15, 2) NOT NULL DEFAULT 0,
  interest NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  installment_number INTEGER NOT NULL
);

-- Warehouse items: inventory for dngro
CREATE TABLE IF NOT EXISTS warehouse_item (
  id SERIAL PRIMARY KEY,
  entity_code VARCHAR(10) NOT NULL REFERENCES entity(code),
  article_name VARCHAR(500) NOT NULL,
  quantity_component NUMERIC(15, 3) NOT NULL DEFAULT 0,
  quantity_finished NUMERIC(15, 3) NOT NULL DEFAULT 0,
  quantity_total NUMERIC(15, 3) NOT NULL DEFAULT 0,
  unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  value_component NUMERIC(15, 2) NOT NULL DEFAULT 0,
  value_finished NUMERIC(15, 2) NOT NULL DEFAULT 0,
  value_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  import_id INTEGER REFERENCES import_log(id)
);

-- Monthly input: manual data (R4) per entity per month
CREATE TABLE IF NOT EXISTS monthly_input (
  id SERIAL PRIMARY KEY,
  entity_code VARCHAR(10) NOT NULL REFERENCES entity(code),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  vat_refund NUMERIC(15, 2) NOT NULL DEFAULT 0,
  salaries_net NUMERIC(15, 2) NOT NULL DEFAULT 0,
  bank_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_code, year, month)
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_invoice_entity_type_due ON invoice (entity_code, document_type, payment_due);
CREATE INDEX IF NOT EXISTS idx_invoice_contractor_nip ON invoice (contractor_nip);
CREATE INDEX IF NOT EXISTS idx_liability_schedule_liability_date ON liability_schedule (liability_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_monthly_input_entity_period ON monthly_input (entity_code, year, month);
