import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './config/db.js';
import { idempotency, purgeOldKeys } from './middleware/idempotency.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import purchaseRoutes from './routes/purchases.js';
import productionRoutes from './routes/production.js';
import inventoryRoutes from './routes/inventory.js';
import customerRoutes from './routes/customers.js';
import orderRoutes from './routes/orders.js';
import financeRoutes from './routes/finance.js';
import reportRoutes from './routes/reports.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  if (process.env.VERCEL) {
    throw new Error('JWT_SECRET មិនទាន់កំណត់ក្នុង Vercel Environment Variables');
  }
  console.error('❌ JWT_SECRET មិនទាន់កំណត់ក្នុង .env');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);   // នៅក្រោយ Nginx — ឱ្យ req.ip ជា IP ពិតរបស់អ្នកប្រើ

// ក្នុងការប្រើពិត កំណត់ CORS_ORIGIN ជាដូមេនរបស់អ្នក
app.use(cors(
  process.env.CORS_ORIGIN
    ? { origin: process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) }
    : {}
));
app.use(express.json({ limit: '1mb' }));

/**
 * កំណត់ចំនួនការសាកល្បងចូល — ការពារការទាយពាក្យសម្ងាត់
 * រក្សាក្នុងអង្គចងចាំ គ្រប់គ្រាន់សម្រាប់ម៉ាស៊ីនតែមួយ
 */
const loginAttempts = new Map();
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

app.use('/api/auth/login', (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const rec = loginAttempts.get(ip);

  if (!rec || now - rec.start > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { start: now, count: 1 });
    return next();
  }
  if (rec.count >= LOGIN_LIMIT) {
    const wait = Math.ceil((LOGIN_WINDOW_MS - (now - rec.start)) / 60000);
    return res.status(429).json({
      error: `សាកល្បងចូលច្រើនដងពេក — សូមរង់ចាំ ${wait} នាទី`,
    });
  }
  rec.count++;
  next();
});

// សម្អាតកំណត់ត្រាចាស់រៀងរាល់ ១៥ នាទី
// (Vercel serverless function ស្លាប់រហ័ស — setInterval គ្មានប្រយោជន៍ទីនោះ រំលង)
if (!process.env.VERCEL) {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of loginAttempts) {
      if (now - rec.start > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
    }
  }, LOGIN_WINDOW_MS).unref();
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, db: 'disconnected' });
  }
});

// ការពារការធ្វើស្ទួន ពេលទូរស័ព្ទផ្ញើឡើងវិញពី offline queue
app.use('/api', idempotency);

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', reportRoutes);

/**
 * សម្អាតលេខសម្គាល់ idempotency ចាស់ — ហៅដោយ Vercel Cron (មើល vercel.json)
 * Vercel Cron ផ្ញើ GET ជាមួយ header `Authorization: Bearer <CRON_SECRET>` ស្វ័យប្រវត្តិ
 * បើកំណត់ environment variable ឈ្មោះ CRON_SECRET
 * នៅលើ VPS មិនចាំបាច់ហៅដោយដៃទេ ព្រោះមាន setInterval ខាងលើរួចហើយ
 */
app.get('/api/admin/purge-idempotency', async (req, res, next) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'គ្មានសិទ្ធិ' });
  }
  try {
    const removed = await purgeOldKeys();
    res.json({ removed });
  } catch (e) { next(e); }
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'រកមិនឃើញផ្លូវនេះ' });
  next();
});

// បម្រើ frontend ដែល build រួច (web/dist) ពីម៉ាស៊ីនមេតែមួយ
const webDist = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res) => res.sendFile(path.join(webDist, 'index.html')));
} else {
  app.use((req, res) => res.status(404).send('រត់ `npm run build` ក្នុងថត web/ ជាមុនសិន'));
}

// Error handler — មិនបញ្ចេញព័ត៌មានខាងក្នុងទៅអ្នកប្រើ
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'មានបញ្ហាក្នុងប្រព័ន្ធ សូមព្យាយាមម្តងទៀត' : err.message,
  });
});

const PORT = process.env.PORT || 3000;

// Vercel ហៅ app នេះជា serverless function ដោយផ្ទាល់ — មិនត្រូវការ .listen()
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ កសិករទំនើប ដំណើរការនៅ http://localhost:${PORT}`);
    purgeOldKeys().catch(() => {});
  });
}

export default app;
