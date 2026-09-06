-- ============================================================
-- កសិករទំនើប — Migration 005
-- ប្តូររូបិយប័ណ្ណទៅជាប្រាក់រៀល (៛)
--
-- ⚠️ សំខាន់: migration នេះប្តូរតែ "ការកំណត់" ប៉ុណ្ណោះ។
-- តម្លៃដែលបានបញ្ចូលរួច (តម្លៃលក់ · ចំណាយ · វិក្កយបត្រចាស់) នៅជាលេខដដែល។
-- ឧ. តម្លៃ 25 ដែលធ្លាប់មានន័យ $25 ឥឡូវនឹងបង្ហាញជា 25៛។
-- ត្រូវកែតម្លៃទាំងនោះឡើងវិញនៅផ្ទាំង «ការកំណត់» ក្រោយពេលរត់ migration នេះ។
-- (មើលចុងឯកសារនេះ បើចង់បម្លែងស្វ័យប្រវត្តិតាមអត្រាប្តូរប្រាក់)
-- ============================================================

BEGIN;

UPDATE settings SET value = '"KHR"'::jsonb, updated_at = now()
WHERE key = 'currency';

-- ប្តូរតម្លៃពិន្ទុភក្ដីភាព តែបើវានៅជាតម្លៃលំនាំដើមដុល្លារ
-- (បើអ្នកបានកែរួចហើយ យើងមិនប៉ះទេ)
UPDATE settings SET value = '40000'::jsonb, updated_at = now()
WHERE key = 'loyalty_amount_per_point' AND value::text = '10';

UPDATE settings SET value = '400'::jsonb, updated_at = now()
WHERE key = 'loyalty_point_value' AND value::text = '0.1';

COMMIT;

-- ============================================================
-- ស្រេចចិត្ត — បម្លែងតម្លៃដែលមានស្រាប់ពីដុល្លារទៅរៀល
--
-- រត់ផ្នែកខាងក្រោមនេះ តែបើទិន្នន័យដែលមានស្រាប់ជាដុល្លារពិត
-- ហើយអ្នកចង់បម្លែងវាទាំងអស់។ កែលេខ 4100 ជាអត្រាដែលអ្នកប្រើ។
-- បម្រុងទុកទិន្នន័យជាមុនសិន!
--
-- BEGIN;
--   UPDATE product_variants SET sell_price   = ROUND(sell_price   * 4100);
--   UPDATE packaging_types  SET unit_cost    = ROUND(unit_cost    * 4100);
--   UPDATE purchase_items   SET unit_price_kg = ROUND(unit_price_kg * 4100, 2),
--                               line_total    = ROUND(line_total    * 4100);
--   UPDATE purchases        SET total_amount = ROUND(total_amount * 4100),
--                               paid_amount  = ROUND(paid_amount  * 4100);
--   UPDATE order_items      SET unit_price   = ROUND(unit_price   * 4100),
--                               line_total    = ROUND(line_total   * 4100);
--   UPDATE orders           SET subtotal = ROUND(subtotal * 4100),
--                               discount = ROUND(discount * 4100),
--                               total    = ROUND(total    * 4100),
--                               paid_amount = ROUND(paid_amount * 4100);
--   UPDATE payments         SET amount = ROUND(amount * 4100);
--   UPDATE expenses         SET amount = ROUND(amount * 4100);
--   UPDATE assets           SET purchase_cost = ROUND(purchase_cost * 4100),
--                               salvage_value = ROUND(salvage_value * 4100);
-- COMMIT;
-- ============================================================
