-- ============================================================
-- កសិករទំនើប — ទិន្នន័យដំបូង (SQL Editor version)
-- សម្រាប់អ្នកប្រើ Supabase SQL Editor ដោយមិនចាំបាច់រត់ npm run seed
-- ត្រូវរត់ក្រោយពី schema.sql · migration_002 · migration_003 ហើយប៉ុណ្ណោះ
-- ============================================================

BEGIN;

INSERT INTO unit_conversions (unit_code, name_km, factor_to_kg) VALUES
  ('kg', 'គីឡូក្រាម', 1),
  ('tonne', 'តោន', 1000),
  ('g', 'ក្រាម', 0.001),
  ('sack50', 'បាវ ៥០គីឡូ', 50),
  ('sack25', 'បាវ ២៥គីឡូ', 25)
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO inventory_locations (name_km) VALUES
  ('ឃ្លាំងរោងចក្រ'), ('ឃ្លាំងបណ្តោះអាសន្ន')
ON CONFLICT DO NOTHING;

INSERT INTO expense_categories (name_km, is_cogs) VALUES
  ('វត្ថុធាតុដើម', TRUE),
  ('ប្រាក់ឈ្នួលកម្មករ', TRUE),
  ('អគ្គិសនី និងទឹក', TRUE),
  ('ដឹកជញ្ជូន', FALSE),
  ('ទីផ្សារ និងផ្សព្វផ្សាយ', FALSE),
  ('រំលស់ទ្រព្យ', FALSE),
  ('ចំណាយរដ្ឋបាល', FALSE)
ON CONFLICT (name_km) DO NOTHING;

INSERT INTO products (code, name_km, category) VALUES
  ('FERT-ORG', 'ជីសរីរាង្គ', 'fertilizer'),
  ('COMPOST',  'ជីកំប៉ុស', 'compost'),
  ('SOIL-GROW','ដីបណ្តុះ', 'growing_soil'),
  ('PLANT',    'ដើមឈើ និងរុក្ខជាតិ', 'plant')
ON CONFLICT (code) DO NOTHING;

INSERT INTO packaging_types (name_km, size_kg, unit_cost) VALUES
  ('បាវ ៥០គីឡូ', 50, 0),
  ('បាវ ២៥គីឡូ', 25, 0),
  ('កញ្ចប់ ៥គីឡូ', 5, 0),
  ('កញ្ចប់ ២គីឡូ', 2, 0)
ON CONFLICT DO NOTHING;

-- គណនី admin ដំបូង
-- អ៊ីមែល:      admin@modernfarmer.kh
-- ពាក្យសម្ងាត់: ChangeMe123!
-- ⚠️ ចូលហើយប្តូរពាក្យសម្ងាត់នេះភ្លាមៗ — hash ខាងក្រោមត្រូវនឹងលេខសម្ងាត់តែមួយនេះ
INSERT INTO users (full_name, email, password_hash, role)
VALUES (
  'អ្នកគ្រប់គ្រង',
  'admin@modernfarmer.kh',
  '$2a$10$8KwzGXFMY2CltS350FWdO./tq2xNz6liYdPpH3kiOLBC3Bqac4TQW',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

COMMIT;
