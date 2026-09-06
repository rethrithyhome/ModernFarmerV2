import express from 'express';
import { query, withTransaction } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { requireValidPhone } from '../utils/phone.js';
import { getUnits, clearUnitCache } from '../utils/units.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();
router.use(authRequired);

// ---------- ឯកតារង្វាស់ ----------
router.get('/units', async (req, res, next) => {
  try { res.json(Object.values(await getUnits())); } catch (e) { next(e); }
});

router.post('/units', requireRole('admin'), async (req, res, next) => {
  try {
    const { unit_code, name_km, factor_to_kg } = req.body;
    const { rows } = await query(
      `INSERT INTO unit_conversions (unit_code, name_km, factor_to_kg) VALUES ($1,$2,$3) RETURNING *`,
      [unit_code, name_km, factor_to_kg]
    );
    clearUnitCache();
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// ---------- តម្លៃកំណត់ប្រព័ន្ធ (ពិន្ទុភក្ដីភាព · រូបិយប័ណ្ណ ...) ----------
router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT key, value, note_km FROM settings ORDER BY key');
    res.json(rows);
  } catch (e) { next(e); }
});

/**
 * ធ្វើបច្ចុប្បន្នភាពតម្លៃកំណត់
 * body: { loyalty_amount_per_point: 10, ... }
 * តម្លៃរក្សាទុកជា JSONB ដូច្នេះលេខត្រូវជាលេខ អក្សរត្រូវជាអក្សរ
 */
router.patch('/settings', requireRole('admin'), async (req, res, next) => {
  try {
    const entries = Object.entries(req.body || {});
    if (entries.length === 0) {
      return res.status(400).json({ error: 'គ្មានតម្លៃត្រូវកែ' });
    }

    const NUMERIC = ['loyalty_amount_per_point', 'loyalty_point_value', 'low_stock_alert_hour'];
    const CURRENCIES = ['KHR', 'USD'];

    const updated = await withTransaction(async (c) => {
      const out = [];
      for (const [key, raw] of entries) {
        const { rows: exists } = await c.query('SELECT key FROM settings WHERE key = $1', [key]);
        if (!exists[0]) {
          const e = new Error(`រកមិនឃើញការកំណត់ "${key}"`); e.status = 400; throw e;
        }

        let value = raw;

        if (key === 'currency') {
          if (!CURRENCIES.includes(raw)) {
            const e = new Error(`រូបិយប័ណ្ណត្រូវជា ${CURRENCIES.join(' ឬ ')}`); e.status = 400; throw e;
          }
        }

        if (NUMERIC.includes(key)) {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) {
            const e = new Error(`តម្លៃ "${key}" ត្រូវជាលេខវិជ្ជមាន`); e.status = 400; throw e;
          }
          if (key === 'low_stock_alert_hour' && (n > 23 || !Number.isInteger(n))) {
            const e = new Error('ម៉ោងជូនដំណឹងត្រូវនៅចន្លោះ ០ ដល់ ២៣'); e.status = 400; throw e;
          }
          if (key === 'loyalty_amount_per_point' && n === 0) {
            const e = new Error('ចំនួនទឹកប្រាក់ក្នុង ១ ពិន្ទុ មិនអាចជាសូន្យ'); e.status = 400; throw e;
          }
          value = n;
        }

        const { rows } = await c.query(
          `UPDATE settings SET value = $2::jsonb, updated_at = now()
           WHERE key = $1 RETURNING key, value, note_km`,
          [key, JSON.stringify(value)]
        );
        out.push(rows[0]);
      }
      await logAudit(c, { userId: req.user.id, action: 'update', table: 'settings',
                          recordId: null, newData: req.body });
      return out;
    });

    res.json(updated);
  } catch (e) { next(e); }
});
router.get('/suppliers', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, r.total_orders, r.on_time_pct, r.total_spent
       FROM suppliers s
       LEFT JOIN v_supplier_reliability r ON r.supplier_id = s.id
       WHERE ($1::boolean IS NULL OR s.is_active = $1)
       ORDER BY s.name`,
      [req.query.active === undefined ? null : req.query.active === 'true']
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/suppliers', requireRole('stock'), async (req, res, next) => {
  try {
    const { name, phone, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'ត្រូវការឈ្មោះអ្នកផ្គត់ផ្គង់' });
    const p = requireValidPhone(phone);
    const { rows } = await query(
      `INSERT INTO suppliers (name, phone_e164, phone_display, address, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, p.e164, p.display, address || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.patch('/suppliers/:id', requireRole('stock'), async (req, res, next) => {
  try {
    const { name, phone, address, notes, is_active } = req.body;
    const p = phone !== undefined ? requireValidPhone(phone) : null;
    const { rows } = await query(
      `UPDATE suppliers SET
         name = COALESCE($2, name),
         phone_e164 = COALESCE($3, phone_e164),
         phone_display = COALESCE($4, phone_display),
         address = COALESCE($5, address),
         notes = COALESCE($6, notes),
         is_active = COALESCE($7, is_active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name ?? null, p?.e164 ?? null, p?.display ?? null,
       address ?? null, notes ?? null, is_active ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញអ្នកផ្គត់ផ្គង់' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ---------- វត្ថុធាតុដើម ----------
router.get('/materials', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT rm.*, s.qty_kg AS stock_kg, s.is_low
       FROM raw_materials rm
       LEFT JOIN v_raw_stock s ON s.raw_material_id = rm.id
       ORDER BY rm.name_km`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/materials', requireRole('stock'), async (req, res, next) => {
  try {
    const { code, name_km, name_en, default_unit, reorder_level_kg } = req.body;
    if (!code || !name_km) return res.status(400).json({ error: 'ត្រូវការលេខកូដ និងឈ្មោះ' });
    const { rows } = await query(
      `INSERT INTO raw_materials (code, name_km, name_en, default_unit, reorder_level_kg)
       VALUES ($1,$2,$3,COALESCE($4,'kg'),COALESCE($5,0)) RETURNING *`,
      [code, name_km, name_en || null, default_unit || null, reorder_level_kg ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'លេខកូដនេះមានរួចហើយ' });
    next(e);
  }
});

router.patch('/materials/:id', requireRole('stock'), async (req, res, next) => {
  try {
    const { name_km, reorder_level_kg, default_unit, is_active } = req.body;
    if (reorder_level_kg != null && !(Number(reorder_level_kg) >= 0)) {
      return res.status(400).json({ error: 'កម្រិតបញ្ជាទិញត្រូវជាលេខមិនអវិជ្ជមាន' });
    }
    const { rows } = await query(
      `UPDATE raw_materials SET
         name_km = COALESCE($2, name_km),
         reorder_level_kg = COALESCE($3, reorder_level_kg),
         default_unit = COALESCE($4, default_unit),
         is_active = COALESCE($5, is_active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name_km ?? null, reorder_level_kg ?? null,
       default_unit ?? null, is_active ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញវត្ថុធាតុដើម' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ---------- ផលិតផល ----------
router.get('/products', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*,
              COALESCE(json_agg(json_build_object(
                'id', v.id, 'sku', v.sku, 'name_km', v.name_km,
                'sell_price', v.sell_price, 'is_active', v.is_active
              ) ORDER BY v.id) FILTER (WHERE v.id IS NOT NULL), '[]') AS variants
       FROM products p
       LEFT JOIN product_variants v ON v.product_id = p.id
       GROUP BY p.id ORDER BY p.name_km`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/products', requireRole('admin'), async (req, res, next) => {
  try {
    const { code, name_km, category } = req.body;
    const { rows } = await query(
      `INSERT INTO products (code, name_km, category) VALUES ($1,$2,$3) RETURNING *`,
      [code, name_km, category || 'other']
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'លេខកូដផលិតផលនេះមានរួចហើយ' });
    next(e);
  }
});

// ---------- វេចខ្ចប់ ----------
router.get('/packaging', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM packaging_types ORDER BY size_kg');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/packaging', requireRole('admin'), async (req, res, next) => {
  try {
    const { name_km, size_kg, unit_cost } = req.body;
    const { rows } = await query(
      `INSERT INTO packaging_types (name_km, size_kg, unit_cost)
       VALUES ($1,$2,COALESCE($3,0)) RETURNING *`,
      [name_km, size_kg, unit_cost ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.patch('/packaging/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { name_km, size_kg, unit_cost, is_active } = req.body;
    if (size_kg != null && !(Number(size_kg) > 0)) {
      return res.status(400).json({ error: 'ទំហំវេចខ្ចប់ត្រូវធំជាងសូន្យ' });
    }
    if (unit_cost != null && !(Number(unit_cost) >= 0)) {
      return res.status(400).json({ error: 'ថ្លៃដើមវេចខ្ចប់មិនអាចអវិជ្ជមាន' });
    }
    const { rows } = await query(
      `UPDATE packaging_types SET
         name_km = COALESCE($2, name_km),
         size_kg = COALESCE($3, size_kg),
         unit_cost = COALESCE($4, unit_cost),
         is_active = COALESCE($5, is_active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name_km ?? null, size_kg ?? null, unit_cost ?? null, is_active ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញទំហំវេចខ្ចប់' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ---------- SKU (បន្ថែមបានភ្លាមៗ ពេលចេញវេចខ្ចប់ថ្មី) ----------
router.post('/variants', requireRole('admin'), async (req, res, next) => {
  try {
    const { sku, product_id, packaging_id, name_km, sell_price, barcode } = req.body;
    if (!sku || !product_id || !name_km) {
      return res.status(400).json({ error: 'ត្រូវការ SKU ផលិតផល និងឈ្មោះ' });
    }
    const { rows } = await query(
      `INSERT INTO product_variants (sku, product_id, packaging_id, name_km, sell_price, barcode)
       VALUES ($1,$2,$3,$4,COALESCE($5,0),$6) RETURNING *`,
      [sku, product_id, packaging_id || null, name_km, sell_price ?? null, barcode || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'SKU នេះមានរួចហើយ' });
    next(e);
  }
});

/** កែតម្លៃលក់ SKU — ប្តូរតម្លៃពេលទីផ្សារប្រែប្រួល ដោយមិនបាច់បង្កើត SKU ថ្មី */
router.patch('/variants/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { name_km, sell_price, barcode, is_active } = req.body;
    if (sell_price != null && !(Number(sell_price) >= 0)) {
      return res.status(400).json({ error: 'តម្លៃលក់មិនអាចអវិជ្ជមាន' });
    }
    const { rows } = await query(
      `UPDATE product_variants SET
         name_km = COALESCE($2, name_km),
         sell_price = COALESCE($3, sell_price),
         barcode = COALESCE($4, barcode),
         is_active = COALESCE($5, is_active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name_km ?? null, sell_price ?? null, barcode ?? null, is_active ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញ SKU' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
