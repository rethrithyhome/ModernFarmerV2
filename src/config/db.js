import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// រក្សា NUMERIC ជាលេខ (មិនមែន string) ដើម្បីងាយគណនា
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

/**
 * នៅលើ Vercel serverless function ដំណើរការឆាប់ស្លាប់ (មិនដូច VPS ដែលរត់ជាប់)
 * ដូច្នេះ pool តូច (max ទាប) សមរម្យជាង — instance ច្រើនកើតឡើងព្រមគ្នា
 * បើភ្ជាប់ច្រើនពេកក្នុង instance តែមួយ អាចលើសដែនកំណត់ Supabase pooler។
 *
 * DB_SSL=true ត្រូវការសម្រាប់ Supabase (និង managed Postgres ភាគច្រើន)។
 */
const onServerless = Boolean(process.env.VERCEL);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: onServerless ? 3 : 10,
  idleTimeoutMillis: onServerless ? 5000 : 30000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export const query = (text, params) => pool.query(text, params);

/**
 * ដំណើរការជាមួយ transaction — បើមានកំហុសណាមួយ ទិន្នន័យត្រឡប់ដើមទាំងអស់។
 * សំខាន់ណាស់សម្រាប់ ការទិញ/ផលិត/លក់ ដែលប៉ះស្តុកព្រមគ្នាច្រើនតារាង។
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
