import express from 'express';
import { query } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { requireValidPhone } from '../utils/phone.js';
import { getUnits, clearUnitCache } from '../utils/units.js';

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

// ---------- អ្នកផ្គត់ផ្គង់ ----------
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

export default router;
