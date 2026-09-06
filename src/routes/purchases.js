import express from 'express';
import { query, withTransaction } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { toKg } from '../utils/units.js';
import { logAudit, nextDocNo } from '../utils/audit.js';

const router = express.Router();
router.use(authRequired);

// បញ្ជីការទិញ
router.get('/', async (req, res, next) => {
  try {
    const { from, to, supplier_id } = req.query;
    const { rows } = await query(
      `SELECT p.*, s.name AS supplier_name
       FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
       WHERE ($1::date IS NULL OR p.purchase_date >= $1)
         AND ($2::date IS NULL OR p.purchase_date <= $2)
         AND ($3::int  IS NULL OR p.supplier_id = $3)
       ORDER BY p.purchase_date DESC, p.id DESC LIMIT 200`,
      [from || null, to || null, supplier_id || null]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// លម្អិត
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, s.name AS supplier_name,
        COALESCE(json_agg(json_build_object(
          'id', i.id, 'raw_material_id', i.raw_material_id, 'material', rm.name_km,
          'qty_input', i.qty_input, 'unit_code', i.unit_code, 'qty_kg', i.qty_kg,
          'unit_price_kg', i.unit_price_kg, 'line_total', i.line_total
        ) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
       FROM purchases p
       JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN purchase_items i ON i.purchase_id = p.id
       LEFT JOIN raw_materials rm ON rm.id = i.raw_material_id
       WHERE p.id = $1 GROUP BY p.id, s.name`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញការទិញ' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/**
 * បង្កើតការទិញ
 * items: [{ raw_material_id, qty_input, unit_code, unit_price_kg }]
 * qty_input អាចជាតោន ឬគីឡូ — server បម្លែងទៅ kg ដោយស្វ័យប្រវត្តិ
 */
router.post('/', requireRole('stock'), async (req, res, next) => {
  try {
    const { supplier_id, purchase_date, invoice_no, expected_date, notes, items } = req.body;
    if (!supplier_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ត្រូវការអ្នកផ្គត់ផ្គង់ និងទំនិញយ៉ាងតិច ១' });
    }

    // បម្លែងឯកតាមុនចូល DB
    const prepared = [];
    for (const it of items) {
      const qty_kg = await toKg(it.qty_input, it.unit_code || 'kg');
      const price = Number(it.unit_price_kg);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: 'តម្លៃក្នុងមួយគីឡូមិនត្រឹមត្រូវ' });
      }
      prepared.push({ ...it, qty_kg, line_total: Number((qty_kg * price).toFixed(2)) });
    }
    const total = prepared.reduce((s, i) => s + i.line_total, 0);

    const result = await withTransaction(async (c) => {
      const purchase_no = await nextDocNo(c, { table: 'purchases', column: 'purchase_no', prefix: 'PO' });
      const { rows } = await c.query(
        `INSERT INTO purchases (purchase_no, supplier_id, purchase_date, invoice_no,
                                expected_date, notes, total_amount, created_by)
         VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4,$5,$6,$7,$8) RETURNING *`,
        [purchase_no, supplier_id, purchase_date || null, invoice_no || null,
         expected_date || null, notes || null, total, req.user.id]
      );
      const purchase = rows[0];

      for (const it of prepared) {
        await c.query(
          `INSERT INTO purchase_items (purchase_id, raw_material_id, qty_input, unit_code,
                                       qty_kg, unit_price_kg, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [purchase.id, it.raw_material_id, it.qty_input, it.unit_code || 'kg',
           it.qty_kg, it.unit_price_kg, it.line_total]
        );
      }
      await logAudit(c, { userId: req.user.id, action: 'create', table: 'purchases',
                          recordId: purchase.id, newData: { purchase_no, total } });
      return purchase;
    });

    res.status(201).json(result);
  } catch (e) { next(e); }
});

/**
 * បញ្ជាក់ការទិញ → ចូលស្តុកវត្ថុធាតុដើម
 * ស្តុកបង្កើនតាម ledger តែប៉ុណ្ណោះ (មិនកែលេខស្តុកផ្ទាល់)
 */
router.post('/:id/confirm', requireRole('stock'), async (req, res, next) => {
  try {
    const result = await withTransaction(async (c) => {
      const { rows: pr } = await c.query(
        'SELECT * FROM purchases WHERE id = $1 FOR UPDATE', [req.params.id]
      );
      const purchase = pr[0];
      if (!purchase) { const e = new Error('រកមិនឃើញការទិញ'); e.status = 404; throw e; }
      if (purchase.status === 'confirmed') {
        const e = new Error('ការទិញនេះបានបញ្ជាក់រួចហើយ'); e.status = 409; throw e;
      }

      const { rows: items } = await c.query(
        'SELECT * FROM purchase_items WHERE purchase_id = $1', [purchase.id]
      );
      for (const it of items) {
        await c.query(
          `INSERT INTO inventory_movements
             (item_kind, raw_material_id, qty_change, reason, ref_table, ref_id, created_by, location_id)
           VALUES ('raw', $1, $2, 'purchase', 'purchases', $3, $4, $5)`,
          [it.raw_material_id, it.qty_kg, purchase.id, req.user.id, req.body.location_id || null]
        );
      }

      const { rows } = await c.query(
        `UPDATE purchases SET status = 'confirmed',
                              received_date = COALESCE($2, CURRENT_DATE)
         WHERE id = $1 RETURNING *`,
        [purchase.id, req.body.received_date || null]
      );
      await logAudit(c, { userId: req.user.id, action: 'confirm', table: 'purchases',
                          recordId: purchase.id, oldData: { status: purchase.status },
                          newData: { status: 'confirmed' } });
      return rows[0];
    });
    res.json(result);
  } catch (e) { next(e); }
});

// កត់ត្រាការទូទាត់ទៅអ្នកផ្គត់ផ្គង់
router.post('/:id/payments', requireRole('stock', 'accountant'), async (req, res, next) => {
  try {
    const { amount, method } = req.body;
    const result = await withTransaction(async (c) => {
      await c.query(
        `INSERT INTO payments (purchase_id, amount, method, created_by) VALUES ($1,$2,$3,$4)`,
        [req.params.id, amount, method || 'cash', req.user.id]
      );
      const { rows } = await c.query(
        `UPDATE purchases p SET
           paid_amount = (SELECT COALESCE(SUM(amount),0) FROM payments WHERE purchase_id = p.id),
           pay_status = CASE
             WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE purchase_id = p.id) >= p.total_amount THEN 'paid'
             WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE purchase_id = p.id) > 0 THEN 'partial'
             ELSE 'unpaid' END::payment_status
         WHERE p.id = $1 RETURNING *`,
        [req.params.id]
      );
      return rows[0];
    });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
