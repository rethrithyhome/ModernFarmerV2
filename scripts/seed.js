import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool, withTransaction } from '../src/config/db.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const mode = process.argv[2] || 'seed';

  if (mode === 'migrate') {
    for (const f of [
      '../db/schema.sql',
      '../db/migration_002_sales_finance.sql',
      '../db/migration_003_offline.sql',
    ]) {
      const sql = fs.readFileSync(path.join(__dirname, f), 'utf8');
      await pool.query(sql);
      console.log(`✅ រត់ ${path.basename(f)} រួចរាល់`);
    }
    await pool.end();
    return;
  }

  await withTransaction(async (c) => {
    // ឯកតារង្វាស់
    await c.query(`
      INSERT INTO unit_conversions (unit_code, name_km, factor_to_kg) VALUES
        ('kg', 'គីឡូក្រាម', 1),
        ('tonne', 'តោន', 1000),
        ('g', 'ក្រាម', 0.001),
        ('sack50', 'បាវ ៥០គីឡូ', 50),
        ('sack25', 'បាវ ២៥គីឡូ', 25)
      ON CONFLICT (unit_code) DO NOTHING`);

    // ទីតាំងឃ្លាំង
    await c.query(`
      INSERT INTO inventory_locations (name_km) VALUES
        ('ឃ្លាំងរោងចក្រ'), ('ឃ្លាំងបណ្តោះអាសន្ន')
      ON CONFLICT DO NOTHING`);

    // ប្រភេទចំណាយ
    await c.query(`
      INSERT INTO expense_categories (name_km, is_cogs) VALUES
        ('វត្ថុធាតុដើម', TRUE),
        ('ប្រាក់ឈ្នួលកម្មករ', TRUE),
        ('អគ្គិសនី និងទឹក', TRUE),
        ('ដឹកជញ្ជូន', FALSE),
        ('ទីផ្សារ និងផ្សព្វផ្សាយ', FALSE),
        ('រំលស់ទ្រព្យ', FALSE),
        ('ចំណាយរដ្ឋបាល', FALSE)
      ON CONFLICT (name_km) DO NOTHING`);

    // ផលិតផលស្នូល
    await c.query(`
      INSERT INTO products (code, name_km, category) VALUES
        ('FERT-ORG', 'ជីសរីរាង្គ', 'fertilizer'),
        ('COMPOST',  'ជីកំប៉ុស', 'compost'),
        ('SOIL-GROW','ដីបណ្តុះ', 'growing_soil'),
        ('PLANT',    'ដើមឈើ និងរុក្ខជាតិ', 'plant')
      ON CONFLICT (code) DO NOTHING`);

    // វេចខ្ចប់
    await c.query(`
      INSERT INTO packaging_types (name_km, size_kg, unit_cost) VALUES
        ('បាវ ៥០គីឡូ', 50, 0),
        ('បាវ ២៥គីឡូ', 25, 0),
        ('កញ្ចប់ ៥គីឡូ', 5, 0),
        ('កញ្ចប់ ២គីឡូ', 2, 0)
      ON CONFLICT DO NOTHING`);

    // គណនី admin ដំបូង
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@modernfarmer.kh';
    const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
    const hash = await bcrypt.hash(password, 10);
    await c.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1,$2,$3,'admin') ON CONFLICT (email) DO NOTHING`,
      ['អ្នកគ្រប់គ្រង', email, hash]
    );
    console.log(`✅ គណនី admin: ${email} — សូមប្តូរពាក្យសម្ងាត់ភ្លាមៗ`);
  });

  console.log('✅ បញ្ចូលទិន្នន័យដំបូងរួចរាល់');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
