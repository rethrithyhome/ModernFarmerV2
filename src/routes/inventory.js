import express from 'express';
import { query, withTransaction } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();
router.use(authRequired);

// ស្តុកវត្ថុធាតុដើម
router.get('/raw', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM v_raw_stock ORDER BY name_km');
    res.json(rows);
  } catch (e) { next(e); }
});

// ស្តុកផលិតផលសម្រេច
router.get('/finished', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM v_finished_stock ORDER BY product_name, name_km');
    res.json(rows);
  } catch (e) { next(e); }
});

// ស្តុកទាប — ប្រើសម្រាប់ជូនដំណឹង Telegram
router.get('/low', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM v_raw_stock WHERE is_low ORDER BY name_km');
    res.json(rows);
  } catch (e) { next(e); }
});

// ប្រវត្តិចលនាស្តុក (audit trail)
router.get('/movements', async (req, res, next) => {
  try {
    const { raw_material_id, product_variant_id, from, to, limit } = req.query;
    const { rows } = await query(
      `SELECT m.*, rm.name_km AS material_name, pv.sku, pv.name_km AS variant_name,
              u.full_name AS created_by_name
       FROM inventory_movements m
       LEFT JOIN raw_materials rm ON rm.id = m.raw_material_id
       LEFT JOIN product_variants pv ON pv.id = m.product_variant_id
       LEFT JOIN users u ON u.id = m.created_by
       WHERE ($1::int IS NULL OR m.raw_material_id = $1)
         AND ($2::int IS NULL OR m.product_variant_id = $2)
         AND ($3::date IS NULL OR m.created_at::date >= $3)
         AND ($4::date IS NULL OR m.created_at::date <= $4)
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $5`,
      [raw_material_id || null, product_variant_id || null, from || null, to || null,
       Math.min(Number(limit) || 100, 500)]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/**
 * កែតម្រូវស្តុកដោយដៃ (ឧ. រាប់ស្តុកពិត បាត់បង់ ខូច)
 * បញ្ចូលជាចលនាថ្មី មិនកែលេខចាស់ — ដើម្បីរក្សា audit trail ពេញលេញ
 */
router.post('/adjust', requireRole('stock'), async (req, res, next) => {
  try {
    const { item_kind, raw_material_id, product_variant_id, qty_change, note, location_id } = req.body;
    if (!['raw', 'finished'].includes(item_kind)) {
      return res.status(400).json({ error: 'ប្រភេទទំនិញត្រូវជា raw ឬ finished' });
    }
    if (!Number.isFinite(Number(qty_change)) || Number(qty_change) === 0) {
      return res.status(400).json({ error: 'បរិមាណកែតម្រូវមិនត្រឹមត្រូវ' });
    }
    if (!note) return res.status(400).json({ error: 'ត្រូវការមូលហេតុកែតម្រូវ' });

    const result = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO inventory_movements
           (item_kind, raw_material_id, product_variant_id, qty_change, reason, note, created_by, location_id)
         VALUES ($1,$2,$3,$4,'adjustment',$5,$6,$7) RETURNING *`,
        [item_kind, raw_material_id || null, product_variant_id || null,
         qty_change, note, req.user.id, location_id || null]
      );
      await logAudit(c, { userId: req.user.id, action: 'adjust', table: 'inventory_movements',
                          recordId: rows[0].id, newData: { qty_change, note } });
      return rows[0];
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// ទីតាំងឃ្លាំង
router.get('/locations', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM inventory_locations WHERE is_active ORDER BY id');
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
