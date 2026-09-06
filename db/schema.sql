-- ============================================================
-- កសិករទំនើប (Modern Farmer) — Database Schema
-- PostgreSQL 14+
-- គោលការណ៍សំខាន់:
--   1. ឯកតាស្តង់ដារតែមួយ = គីឡូក្រាម (kg) សម្រាប់វត្ថុធាតុដើម និងផលិតកម្ម
--   2. លេខទូរស័ព្ទរក្សាទុក ២ ទម្រង់: normalized (+855...) និង display
--   3. ស្តុកគណនាពី inventory_movements (ledger) មិនមែនកែលេខផ្ទាល់
--   4. គ្រប់ការកែប្រែសំខាន់ៗចូល audit_log
-- ============================================================

BEGIN;

-- ---------- ENUM types ----------
CREATE TYPE user_role       AS ENUM ('admin', 'stock', 'sales', 'accountant');
CREATE TYPE item_type       AS ENUM ('raw', 'finished');
CREATE TYPE product_category AS ENUM ('fertilizer', 'compost', 'growing_soil', 'plant', 'other');
CREATE TYPE customer_type   AS ENUM ('retail', 'wholesale', 'farmer', 'distributor');
CREATE TYPE doc_status      AS ENUM ('draft', 'confirmed', 'cancelled');
CREATE TYPE payment_status  AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE batch_status    AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');

-- ============================================================
-- ១. អ្នកប្រើប្រាស់ & សិទ្ធិ
-- ============================================================
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone_e164    TEXT,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'sales',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ២. ឯកតារង្វាស់ (បម្លែងទៅ kg ស្វ័យប្រវត្តិ)
--    ដោះស្រាយបញ្ហា តោន/គីឡូ ដែលធ្លាប់កើតក្នុងប្រព័ន្ធចាស់
-- ============================================================
CREATE TABLE unit_conversions (
  unit_code   TEXT PRIMARY KEY,      -- 'kg', 'tonne', 'sack50', 'g'
  name_km     TEXT NOT NULL,
  factor_to_kg NUMERIC(14,6) NOT NULL CHECK (factor_to_kg > 0)
);

-- ============================================================
-- ៣. អ្នកផ្គត់ផ្គង់ & វត្ថុធាតុដើម
-- ============================================================
CREATE TABLE suppliers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  phone_e164    TEXT,
  phone_display TEXT,
  address       TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_name ON suppliers (lower(name));

CREATE TABLE raw_materials (
  id               SERIAL PRIMARY KEY,
  code             TEXT UNIQUE NOT NULL,
  name_km          TEXT NOT NULL,
  name_en          TEXT,
  default_unit     TEXT NOT NULL DEFAULT 'kg' REFERENCES unit_conversions(unit_code),
  reorder_level_kg NUMERIC(14,3) NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ៤. ការទិញវត្ថុធាតុដើម
-- ============================================================
CREATE TABLE purchases (
  id             SERIAL PRIMARY KEY,
  purchase_no    TEXT UNIQUE NOT NULL,
  supplier_id    INT NOT NULL REFERENCES suppliers(id),
  purchase_date  DATE NOT NULL,
  invoice_no     TEXT,
  total_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  pay_status     payment_status NOT NULL DEFAULT 'unpaid',
  status         doc_status NOT NULL DEFAULT 'draft',
  expected_date  DATE,        -- សម្រាប់វាស់ភាពទៀងទាត់អ្នកផ្គត់ផ្គង់
  received_date  DATE,
  notes          TEXT,
  created_by     INT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchases_supplier ON purchases (supplier_id, purchase_date DESC);

CREATE TABLE purchase_items (
  id              SERIAL PRIMARY KEY,
  purchase_id     INT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  raw_material_id INT NOT NULL REFERENCES raw_materials(id),
  qty_input       NUMERIC(14,3) NOT NULL CHECK (qty_input > 0),  -- លេខដែលអ្នកប្រើវាយចូល
  unit_code       TEXT NOT NULL REFERENCES unit_conversions(unit_code),
  qty_kg          NUMERIC(14,3) NOT NULL CHECK (qty_kg > 0),     -- បម្លែងរួច (server គណនា)
  unit_price_kg   NUMERIC(14,4) NOT NULL CHECK (unit_price_kg >= 0),
  line_total      NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- ៥. ផលិតផល · វេចខ្ចប់ · SKU
--    បន្ថែម SKU ថ្មីបានដោយមិនចាំបាច់កែ code
-- ============================================================
CREATE TABLE products (
  id         SERIAL PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  name_km    TEXT NOT NULL,
  category   product_category NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE packaging_types (
  id         SERIAL PRIMARY KEY,
  name_km    TEXT NOT NULL,
  size_kg    NUMERIC(10,3) NOT NULL CHECK (size_kg > 0),
  unit_cost  NUMERIC(12,4) NOT NULL DEFAULT 0,   -- ថ្លៃដើមកញ្ចប់/បាវ ដាច់ពីថ្លៃដើមផលិត
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE product_variants (
  id           SERIAL PRIMARY KEY,
  sku          TEXT UNIQUE NOT NULL,
  product_id   INT NOT NULL REFERENCES products(id),
  packaging_id INT REFERENCES packaging_types(id),
  name_km      TEXT NOT NULL,
  sell_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  barcode      TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_variant_product ON product_variants (product_id);

-- ============================================================
-- ៦. រូបមន្តលាយ (Recipes)
-- ============================================================
CREATE TABLE recipes (
  id           SERIAL PRIMARY KEY,
  product_id   INT NOT NULL REFERENCES products(id),
  name         TEXT NOT NULL,
  version      INT NOT NULL DEFAULT 1,
  base_batch_kg NUMERIC(14,3) NOT NULL DEFAULT 1000,  -- រូបមន្តគិតលើ batch ទំហំនេះ
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);

CREATE TABLE recipe_items (
  id              SERIAL PRIMARY KEY,
  recipe_id       INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  raw_material_id INT NOT NULL REFERENCES raw_materials(id),
  qty_kg          NUMERIC(14,3) NOT NULL CHECK (qty_kg > 0)
);

-- ============================================================
-- ៧. ផលិតកម្ម (Batch)
-- ============================================================
CREATE TABLE production_batches (
  id                SERIAL PRIMARY KEY,
  batch_code        TEXT UNIQUE NOT NULL,
  product_id        INT NOT NULL REFERENCES products(id),
  recipe_id         INT REFERENCES recipes(id),
  start_date        DATE NOT NULL,
  end_date          DATE,
  planned_output_kg NUMERIC(14,3) NOT NULL DEFAULT 0,
  actual_output_kg  NUMERIC(14,3) NOT NULL DEFAULT 0,
  status            batch_status NOT NULL DEFAULT 'planned',
  notes             TEXT,
  created_by        INT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE production_inputs (
  id              SERIAL PRIMARY KEY,
  batch_id        INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  raw_material_id INT NOT NULL REFERENCES raw_materials(id),
  qty_kg          NUMERIC(14,3) NOT NULL CHECK (qty_kg > 0)
);

-- ការវេចខ្ចប់ចេញពី batch → ក្លាយជាស្តុកផលិតផលសម្រេច
CREATE TABLE packaging_runs (
  id                 SERIAL PRIMARY KEY,
  batch_id           INT NOT NULL REFERENCES production_batches(id),
  product_variant_id INT NOT NULL REFERENCES product_variants(id),
  qty_units          INT NOT NULL CHECK (qty_units > 0),
  packed_kg          NUMERIC(14,3) NOT NULL,
  packaging_cost     NUMERIC(14,2) NOT NULL DEFAULT 0,
  run_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by         INT REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ៨. ស្តុក (ledger — ស្តុកជាលទ្ធផលនៃចលនា មិនកែផ្ទាល់)
-- ============================================================
CREATE TABLE inventory_locations (
  id      SERIAL PRIMARY KEY,
  name_km TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE inventory_movements (
  id                 BIGSERIAL PRIMARY KEY,
  item_kind          item_type NOT NULL,
  raw_material_id    INT REFERENCES raw_materials(id),
  product_variant_id INT REFERENCES product_variants(id),
  batch_id           INT REFERENCES production_batches(id),
  location_id        INT REFERENCES inventory_locations(id),
  qty_change         NUMERIC(14,3) NOT NULL,  -- + ចូល / − ចេញ (kg សម្រាប់ raw, units សម្រាប់ finished)
  reason             TEXT NOT NULL,           -- purchase / production_consume / packaging_in / sale / adjustment
  ref_table          TEXT,
  ref_id             INT,
  note               TEXT,
  created_by         INT REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_item_ref CHECK (
    (item_kind = 'raw'      AND raw_material_id IS NOT NULL AND product_variant_id IS NULL) OR
    (item_kind = 'finished' AND product_variant_id IS NOT NULL AND raw_material_id IS NULL)
  )
);
CREATE INDEX idx_mov_raw ON inventory_movements (raw_material_id, created_at DESC);
CREATE INDEX idx_mov_fin ON inventory_movements (product_variant_id, created_at DESC);

-- ============================================================
-- ៩. អតិថិជន & ការលក់
-- ============================================================
CREATE TABLE customers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  phone_e164    TEXT,            -- normalized: +855XXXXXXXX
  phone_display TEXT,            -- 0XX XXX XXX
  ctype         customer_type NOT NULL DEFAULT 'retail',
  address       TEXT,
  province      TEXT,
  loyalty_points INT NOT NULL DEFAULT 0,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_customer_phone ON customers (phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  order_no     TEXT UNIQUE NOT NULL,
  customer_id  INT REFERENCES customers(id),
  order_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal     NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  pay_status   payment_status NOT NULL DEFAULT 'unpaid',
  status       doc_status NOT NULL DEFAULT 'draft',
  notes        TEXT,
  created_by   INT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_customer ON orders (customer_id, order_date DESC);

CREATE TABLE order_items (
  id                 SERIAL PRIMARY KEY,
  order_id           INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_variant_id INT NOT NULL REFERENCES product_variants(id),
  batch_id           INT REFERENCES production_batches(id),
  qty_units          INT NOT NULL CHECK (qty_units > 0),
  unit_price         NUMERIC(12,2) NOT NULL,
  line_total         NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE payments (
  id          SERIAL PRIMARY KEY,
  order_id    INT REFERENCES orders(id),
  purchase_id INT REFERENCES purchases(id),
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method      TEXT NOT NULL DEFAULT 'cash',
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  INT REFERENCES users(id),
  CONSTRAINT chk_payment_target CHECK (
    (order_id IS NOT NULL AND purchase_id IS NULL) OR
    (order_id IS NULL AND purchase_id IS NOT NULL)
  )
);

-- ============================================================
-- ១០. ហិរញ្ញវត្ថុ — ចំណាយ & ទ្រព្យ/រំលស់
-- ============================================================
CREATE TABLE assets (
  id                SERIAL PRIMARY KEY,
  name_km           TEXT NOT NULL,
  purchase_cost     NUMERIC(14,2) NOT NULL,
  purchase_date     DATE NOT NULL,
  useful_life_months INT NOT NULL CHECK (useful_life_months > 0),
  salvage_value     NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE expense_categories (
  id       SERIAL PRIMARY KEY,
  name_km  TEXT UNIQUE NOT NULL,
  is_cogs  BOOLEAN NOT NULL DEFAULT FALSE  -- រាប់ចូលថ្លៃដើមលក់ឬអត់
);

CREATE TABLE expenses (
  id           SERIAL PRIMARY KEY,
  category_id  INT NOT NULL REFERENCES expense_categories(id),
  asset_id     INT REFERENCES assets(id),   -- បើជារំលស់
  description  TEXT,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  batch_id     INT REFERENCES production_batches(id),  -- ភ្ជាប់ចំណាយទៅ batch បើមាន
  created_by   INT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_date ON expenses (expense_date DESC);

-- ============================================================
-- ១១. Audit log
-- ============================================================
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id),
  action     TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id  TEXT,
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_table ON audit_log (table_name, created_at DESC);

-- ============================================================
-- ១២. Views — ស្តុកបច្ចុប្បន្ន & ការវិភាគ
-- ============================================================
CREATE VIEW v_raw_stock AS
SELECT rm.id AS raw_material_id,
       rm.code, rm.name_km,
       COALESCE(SUM(m.qty_change), 0) AS qty_kg,
       rm.reorder_level_kg,
       (COALESCE(SUM(m.qty_change), 0) <= rm.reorder_level_kg) AS is_low
FROM raw_materials rm
LEFT JOIN inventory_movements m
       ON m.raw_material_id = rm.id AND m.item_kind = 'raw'
GROUP BY rm.id;

CREATE VIEW v_finished_stock AS
SELECT pv.id AS product_variant_id,
       pv.sku, pv.name_km,
       p.name_km AS product_name,
       COALESCE(SUM(m.qty_change), 0) AS qty_units
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
LEFT JOIN inventory_movements m
       ON m.product_variant_id = pv.id AND m.item_kind = 'finished'
GROUP BY pv.id, p.name_km;

-- អត្រាទិន្នផល (yield rate) ក្នុង batch នីមួយៗ
CREATE VIEW v_batch_yield AS
SELECT b.id AS batch_id,
       b.batch_code,
       p.name_km AS product_name,
       b.actual_output_kg,
       COALESCE(SUM(pi.qty_kg), 0) AS total_input_kg,
       CASE WHEN COALESCE(SUM(pi.qty_kg), 0) > 0
            THEN ROUND(b.actual_output_kg / SUM(pi.qty_kg) * 100, 2)
            ELSE NULL END AS yield_pct
FROM production_batches b
JOIN products p ON p.id = b.product_id
LEFT JOIN production_inputs pi ON pi.batch_id = b.id
GROUP BY b.id, p.name_km;

-- ភាពជឿទុកចិត្តអ្នកផ្គត់ផ្គង់ (គណនាពីទិន្នន័យពិត)
CREATE VIEW v_supplier_reliability AS
SELECT s.id AS supplier_id,
       s.name,
       COUNT(pu.id) AS total_orders,
       COUNT(*) FILTER (WHERE pu.received_date IS NOT NULL
                          AND pu.expected_date IS NOT NULL
                          AND pu.received_date <= pu.expected_date) AS on_time_orders,
       CASE WHEN COUNT(*) FILTER (WHERE pu.received_date IS NOT NULL AND pu.expected_date IS NOT NULL) > 0
            THEN ROUND(
              COUNT(*) FILTER (WHERE pu.received_date <= pu.expected_date)::NUMERIC
              / COUNT(*) FILTER (WHERE pu.received_date IS NOT NULL AND pu.expected_date IS NOT NULL) * 100, 1)
            ELSE NULL END AS on_time_pct,
       COALESCE(SUM(pu.total_amount), 0) AS total_spent
FROM suppliers s
LEFT JOIN purchases pu ON pu.supplier_id = s.id AND pu.status = 'confirmed'
GROUP BY s.id;

COMMIT;
