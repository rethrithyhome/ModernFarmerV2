-- ============================================================
-- កសិករទំនើប — Migration 002 (ដំណាក់កាល ២)
-- លក់ & CRM · ហិរញ្ញវត្ថុ · របាយការណ៍
-- រត់បន្ទាប់ពី schema.sql
-- ============================================================

BEGIN;

-- ---------- ការកំណត់ប្រព័ន្ធ (កែបានដោយមិនប៉ះ code) ----------
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  note_km    TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value, note_km) VALUES
  ('currency', '"KHR"', 'រូបិយប័ណ្ណប្រើក្នុងប្រព័ន្ធ (KHR ឬ USD)'),
  ('loyalty_amount_per_point', '40000', 'ចំណាយប៉ុន្មាន ដើម្បីបាន ១ ពិន្ទុ'),
  ('loyalty_point_value', '400', 'តម្លៃ ១ ពិន្ទុ ពេលដូរជាការបញ្ចុះតម្លៃ'),
  ('low_stock_alert_hour', '7', 'ម៉ោងផ្ញើសារជូនដំណឹងស្តុកទាប')
ON CONFLICT (key) DO NOTHING;

-- ---------- ប្រវត្តិពិន្ទុភក្ដីភាព (ដើម្បីដឹងពិន្ទុមកពីណា) ----------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          BIGSERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  order_id    INT REFERENCES orders(id),
  points      INT NOT NULL,              -- + ទទួល / − ប្រើ
  reason      TEXT NOT NULL,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer
  ON loyalty_transactions (customer_id, created_at DESC);

-- ---------- ចំណាយ: ការពារកុំឱ្យប្រកាសរំលស់ស្ទួនក្នុងខែតែមួយ ----------
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_month DATE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_depreciation_once
  ON expenses (asset_id, period_month)
  WHERE asset_id IS NOT NULL;

-- ============================================================
-- Views — ហិរញ្ញវត្ថុ & របាយការណ៍
-- ============================================================

-- រំលស់ខ្សែត្រង់ (straight-line) ក្នុងមួយខែ
CREATE OR REPLACE VIEW v_asset_depreciation AS
SELECT a.id AS asset_id,
       a.name_km,
       a.purchase_cost,
       a.salvage_value,
       a.useful_life_months,
       a.purchase_date,
       ROUND((a.purchase_cost - a.salvage_value) / a.useful_life_months, 2) AS monthly_depreciation,
       (a.purchase_date + (a.useful_life_months || ' months')::interval)::date AS end_date,
       (CURRENT_DATE < (a.purchase_date + (a.useful_life_months || ' months')::interval)::date) AS is_depreciating
FROM assets a
WHERE a.is_active;

-- ចំណូលតាមខែ
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT date_trunc('month', o.order_date)::date AS month,
       COUNT(*)                     AS order_count,
       COALESCE(SUM(o.total), 0)    AS revenue,
       COALESCE(SUM(o.paid_amount), 0) AS collected
FROM orders o
WHERE o.status = 'confirmed'
GROUP BY 1;

-- ចំណាយតាមខែ
CREATE OR REPLACE VIEW v_monthly_expense AS
SELECT date_trunc('month', e.expense_date)::date AS month,
       COALESCE(SUM(e.amount), 0) AS total_expense,
       COALESCE(SUM(e.amount) FILTER (WHERE c.is_cogs), 0) AS cogs,
       COALESCE(SUM(e.amount) FILTER (WHERE NOT c.is_cogs), 0) AS opex
FROM expenses e
JOIN expense_categories c ON c.id = e.category_id
GROUP BY 1;

-- ចំណេញ-ខាតតាមខែ
CREATE OR REPLACE VIEW v_monthly_pnl AS
SELECT COALESCE(r.month, e.month) AS month,
       COALESCE(r.revenue, 0)       AS revenue,
       COALESCE(e.cogs, 0)          AS cogs,
       COALESCE(e.opex, 0)          AS opex,
       COALESCE(r.revenue, 0) - COALESCE(e.cogs, 0) AS gross_profit,
       COALESCE(r.revenue, 0) - COALESCE(e.total_expense, 0) AS net_profit
FROM v_monthly_revenue r
FULL OUTER JOIN v_monthly_expense e ON e.month = r.month;

-- ការលក់តាមផលិតផល
CREATE OR REPLACE VIEW v_sales_by_variant AS
SELECT pv.id AS product_variant_id,
       pv.sku,
       pv.name_km,
       p.name_km AS product_name,
       -- FILTER សំខាន់: LEFT JOIN ទោះដាក់លក្ខខណ្ឌ status ក៏នៅរាប់ជួរ
       -- របស់វិក្កយបត្រ draft/cancelled ដែរ បើមិនត្រង
       COALESCE(SUM(oi.qty_units)  FILTER (WHERE o.status = 'confirmed'), 0) AS units_sold,
       COALESCE(SUM(oi.line_total) FILTER (WHERE o.status = 'confirmed'), 0) AS revenue
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
LEFT JOIN order_items oi ON oi.product_variant_id = pv.id
LEFT JOIN orders o ON o.id = oi.order_id
GROUP BY pv.id, p.name_km;

-- ការលក់តាមខែ × ផលិតផល (សម្រាប់ព្យាករតាមរដូវកាល)
CREATE OR REPLACE VIEW v_seasonal_sales AS
SELECT EXTRACT(MONTH FROM o.order_date)::int AS month_no,
       p.id   AS product_id,
       p.name_km AS product_name,
       COUNT(DISTINCT o.id)            AS order_count,
       COALESCE(SUM(oi.qty_units), 0)  AS units_sold,
       COALESCE(SUM(oi.line_total), 0) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN product_variants pv ON pv.id = oi.product_variant_id
JOIN products p ON p.id = pv.product_id
WHERE o.status = 'confirmed'
GROUP BY 1, 2, 3;

-- អតិថិជនល្អបំផុត
CREATE OR REPLACE VIEW v_customer_summary AS
SELECT c.id AS customer_id,
       c.name,
       c.phone_display,
       c.ctype,
       c.loyalty_points,
       COUNT(o.id)                       AS order_count,
       COALESCE(SUM(o.total), 0)         AS lifetime_value,
       MAX(o.order_date)                 AS last_order_date,
       (CURRENT_DATE - MAX(o.order_date)) AS days_since_last_order
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'confirmed'
GROUP BY c.id;

COMMIT;
