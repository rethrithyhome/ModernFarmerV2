import express from 'express';
import { query, withTransaction } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { logAudit, nextDocNo } from '../utils/audit.js';

const router = express.Router();
router.use(authRequired);

// ---------- រូបមន្តលាយ ----------
router.get('/recipes', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.*, p.name_km AS product_name,
        COALESCE(json_agg(json_build_object(
          'raw_material_id', ri.raw_material_id, 'material', rm.name_km, 'qty_kg', ri.qty_kg
        ) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL), '[]') AS items
       FROM recipes r
       JOIN products p ON p.id = r.product_id
       LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
       LEFT JOIN raw_materials rm ON rm.id = ri.raw_material_id
       GROUP BY r.id, p.name_km ORDER BY p.name_km, r.version DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/recipes', requireRole('admin', 'stock'), async (req, res, next) => {
  try {
    const { product_id, name, base_batch_kg, items } = req.body;
    if (!product_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ត្រូវការផលិតផល និងវត្ថុធាតុដើមយ៉ាងតិច ១' });
    }
    const result = await withTransaction(async (c) => {
      const { rows: v } = await c.query(
        'SELECT COALESCE(MAX(version),0)+1 AS next FROM recipes WHERE product_id = $1', [product_id]
      );
      const { rows } = await c.query(
        `INSERT INTO recipes (product_id, name, version, base_batch_kg)
         VALUES ($1,$2,$3,COALESCE($4,1000)) RETURNING *`,
        [product_id, name || 'រូបមន្តស្តង់ដារ', v[0].next, base_batch_kg ?? null]
      );
      for (const it of items) {
        await c.query(
          'INSERT INTO recipe_items (recipe_id, raw_material_id, qty_kg) VALUES ($1,$2,$3)',
          [rows[0].id, it.raw_material_id, it.qty_kg]
        );
      }
      return rows[0];
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// ---------- Batch ផលិតកម្ម ----------
router.get('/batches', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT b.*, p.name_km AS product_name, y.total_input_kg, y.yield_pct
       FROM production_batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN v_batch_yield y ON y.batch_id = b.id
       ORDER BY b.start_date DESC, b.id DESC LIMIT 200`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/batches', requireRole('stock'), async (req, res, next) => {
  try {
    const { product_id, recipe_id, start_date, planned_output_kg, notes } = req.body;
    if (!product_id) return res.status(400).json({ error: 'ត្រូវការផលិតផល' });
    const result = await withTransaction(async (c) => {
      const batch_code = await nextDocNo(c, {
        table: 'production_batches', column: 'batch_code', prefix: 'B'
      });
      const { rows } = await c.query(
        `INSERT INTO production_batches
           (batch_code, product_id, recipe_id, start_date, planned_output_kg, notes, created_by)
         VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE),COALESCE($5,0),$6,$7) RETURNING *`,
        [batch_code, product_id, recipe_id || null, start_date || null,
         planned_output_kg ?? null, notes || null, req.user.id]
      );
      return rows[0];
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

/**
 * បញ្ចូលវត្ថុធាតុដើមចូល batch → ដកស្តុកស្វ័យប្រវត្តិ
 * ត្រួតពិនិត្យស្តុកគ្រប់គ្រាន់មុនដក (មិនទុកឱ្យស្តុកអវិជ្ជមាន)
 */
router.post('/batches/:id/inputs', requireRole('stock'), async (req, res, next) => {
  try {
    const inputs = req.body.inputs;
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return res.status(400).json({ error: 'ត្រូវការវត្ថុធាតុដើមយ៉ាងតិច ១' });
    }
    const result = await withTransaction(async (c) => {
      const { rows: b } = await c.query(
        'SELECT * FROM production_batches WHERE id = $1 FOR UPDATE', [req.params.id]
      );
      if (!b[0]) { const e = new Error('រកមិនឃើញ batch'); e.status = 404; throw e; }
      if (b[0].status === 'completed') {
        const e = new Error('Batch នេះបញ្ចប់រួចហើយ មិនអាចបន្ថែមវត្ថុធាតុដើមទេ'); e.status = 409; throw e;
      }

      for (const it of inputs) {
        const { rows: st } = await c.query(
          `SELECT COALESCE(SUM(qty_change),0) AS qty, rm.name_km
           FROM raw_materials rm
           LEFT JOIN inventory_movements m
             ON m.raw_material_id = rm.id AND m.item_kind = 'raw'
           WHERE rm.id = $1 GROUP BY rm.name_km`,
          [it.raw_material_id]
        );
        const available = Number(st[0]?.qty || 0);
        if (available < Number(it.qty_kg)) {
          const e = new Error(
            `ស្តុក "${st[0]?.name_km || it.raw_material_id}" មិនគ្រប់គ្រាន់ ` +
            `(មាន ${available} គីឡូ ត្រូវការ ${it.qty_kg} គីឡូ)`
          );
          e.status = 409; throw e;
        }

        await c.query(
          'INSERT INTO production_inputs (batch_id, raw_material_id, qty_kg) VALUES ($1,$2,$3)',
          [b[0].id, it.raw_material_id, it.qty_kg]
        );
        await c.query(
          `INSERT INTO inventory_movements
             (item_kind, raw_material_id, batch_id, qty_change, reason, ref_table, ref_id, created_by)
           VALUES ('raw', $1, $2, $3, 'production_consume', 'production_batches', $2, $4)`,
          [it.raw_material_id, b[0].id, -Math.abs(Number(it.qty_kg)), req.user.id]
        );
      }

      await c.query(
        `UPDATE production_batches SET status = 'in_progress' WHERE id = $1 AND status = 'planned'`,
        [b[0].id]
      );
      const { rows } = await c.query('SELECT * FROM v_batch_yield WHERE batch_id = $1', [b[0].id]);
      return rows[0];
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// បញ្ចប់ batch — កត់ទិន្នផលពិត
router.post('/batches/:id/complete', requireRole('stock'), async (req, res, next) => {
  try {
    const { actual_output_kg, end_date } = req.body;
    if (!(Number(actual_output_kg) > 0)) {
      return res.status(400).json({ error: 'ត្រូវការទិន្នផលពិត (គីឡូ)' });
    }
    const result = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `UPDATE production_batches
         SET actual_output_kg = $2, end_date = COALESCE($3, CURRENT_DATE), status = 'completed'
         WHERE id = $1 AND status <> 'cancelled' RETURNING *`,
        [req.params.id, actual_output_kg, end_date || null]
      );
      if (!rows[0]) { const e = new Error('រកមិនឃើញ batch'); e.status = 404; throw e; }
      await logAudit(c, { userId: req.user.id, action: 'complete', table: 'production_batches',
                          recordId: rows[0].id, newData: { actual_output_kg } });
      const { rows: y } = await c.query('SELECT * FROM v_batch_yield WHERE batch_id = $1', [rows[0].id]);
      return { batch: rows[0], yield: y[0] };
    });
    res.json(result);
  } catch (e) { next(e); }
});

/**
 * វេចខ្ចប់ → បង្កើតស្តុកផលិតផលសម្រេច (units)
 */
router.post('/batches/:id/packaging', requireRole('stock'), async (req, res, next) => {
  try {
    const { product_variant_id, qty_units, run_date, location_id } = req.body;
    if (!product_variant_id || !(Number(qty_units) > 0)) {
      return res.status(400).json({ error: 'ត្រូវការ SKU និងចំនួនកញ្ចប់' });
    }
    const result = await withTransaction(async (c) => {
      const { rows: v } = await c.query(
        `SELECT pv.id, pv.sku, COALESCE(pk.size_kg,0) AS size_kg, COALESCE(pk.unit_cost,0) AS unit_cost
         FROM product_variants pv
         LEFT JOIN packaging_types pk ON pk.id = pv.packaging_id
         WHERE pv.id = $1`, [product_variant_id]
      );
      if (!v[0]) { const e = new Error('រកមិនឃើញ SKU'); e.status = 404; throw e; }

      const packed_kg = Number((v[0].size_kg * qty_units).toFixed(3));
      const packaging_cost = Number((v[0].unit_cost * qty_units).toFixed(2));

      const { rows } = await c.query(
        `INSERT INTO packaging_runs
           (batch_id, product_variant_id, qty_units, packed_kg, packaging_cost, run_date, created_by)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,CURRENT_DATE),$7) RETURNING *`,
        [req.params.id, product_variant_id, qty_units, packed_kg, packaging_cost,
         run_date || null, req.user.id]
      );
      await c.query(
        `INSERT INTO inventory_movements
           (item_kind, product_variant_id, batch_id, qty_change, reason, ref_table, ref_id, created_by, location_id)
         VALUES ('finished', $1, $2, $3, 'packaging_in', 'packaging_runs', $4, $5, $6)`,
        [product_variant_id, req.params.id, qty_units, rows[0].id, req.user.id, location_id || null]
      );
      return rows[0];
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

export default router;
