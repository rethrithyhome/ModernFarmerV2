import express from 'express';
import { query, withTransaction } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { logAudit, nextDocNo } from '../utils/audit.js';

const router = express.Router();
router.use(authRequired);

// បញ្ជីការលក់
router.get('/', async (req, res, next) => {
  try {
    const { from, to, customer_id, status } = req.query;
    const { rows } = await query(
      `SELECT o.*, c.name AS customer_name, c.phone_display, u.full_name AS created_by_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.created_by
       WHERE ($1::date IS NULL OR o.order_date >= $1)
         AND ($2::date IS NULL OR o.order_date <= $2)
         AND ($3::int  IS NULL OR o.customer_id = $3)
         AND ($4::text IS NULL OR o.status::text = $4)
       ORDER BY o.order_date DESC, o.id DESC LIMIT 200`,
      [from || null, to || null, customer_id || null, status || null]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// លម្អិតវិក្កយបត្រ
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.*, c.name AS customer_name, c.phone_display, c.address,
        COALESCE(json_agg(json_build_object(
          'id', i.id, 'product_variant_id', i.product_variant_id, 'sku', pv.sku,
          'name_km', pv.name_km, 'batch_id', i.batch_id, 'qty_units', i.qty_units,
          'unit_price', i.unit_price, 'line_total', i.line_total
        ) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN order_items i ON i.order_id = o.id
       LEFT JOIN product_variants pv ON pv.id = i.product_variant_id
       WHERE o.id = $1
       GROUP BY o.id, c.name, c.phone_display, c.address`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញវិក្កយបត្រ' });

    const { rows: pay } = await query(
      'SELECT amount, method, paid_at FROM payments WHERE order_id = $1 ORDER BY paid_at',
      [req.params.id]
    );
    res.json({ ...rows[0], payments: pay });
  } catch (e) { next(e); }
});

/**
 * បង្កើតវិក្កយបត្រ (draft — មិនទាន់ដកស្តុក)
 * items: [{ product_variant_id, qty_units, unit_price?, batch_id? }]
 * បើមិនដាក់ unit_price នឹងយកតម្លៃលក់ពី SKU
 */
router.post('/', requireRole('sales'), async (req, res, next) => {
  try {
    const { customer_id, order_date, discount, notes, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ត្រូវការទំនិញយ៉ាងតិច ១' });
    }

    const result = await withTransaction(async (c) => {
      const prepared = [];
      for (const it of items) {
        const { rows: v } = await c.query(
          'SELECT id, sku, sell_price, is_active FROM product_variants WHERE id = $1',
          [it.product_variant_id]
        );
        if (!v[0]) { const e = new Error(`រកមិនឃើញ SKU (id ${it.product_variant_id})`); e.status = 400; throw e; }
        if (!v[0].is_active) { const e = new Error(`SKU ${v[0].sku} ត្រូវបានបិទ`); e.status = 400; throw e; }

        const qty = Number(it.qty_units);
        if (!Number.isInteger(qty) || qty <= 0) {
          const e = new Error(`ចំនួនកញ្ចប់មិនត្រឹមត្រូវសម្រាប់ ${v[0].sku}`); e.status = 400; throw e;
        }
        const price = it.unit_price != null ? Number(it.unit_price) : Number(v[0].sell_price);
        if (!Number.isFinite(price) || price < 0) {
          const e = new Error(`តម្លៃមិនត្រឹមត្រូវសម្រាប់ ${v[0].sku}`); e.status = 400; throw e;
        }
        prepared.push({ ...it, qty_units: qty, unit_price: price,
                        line_total: Number((qty * price).toFixed(2)) });
      }

      const subtotal = prepared.reduce((s, i) => s + i.line_total, 0);
      const disc = Number(discount || 0);
      if (disc > subtotal) { const e = new Error('ការបញ្ចុះតម្លៃលើសសរុប'); e.status = 400; throw e; }
      const total = Number((subtotal - disc).toFixed(2));

      const order_no = await nextDocNo(c, { table: 'orders', column: 'order_no', prefix: 'SO' });
      const { rows } = await c.query(
        `INSERT INTO orders (order_no, customer_id, order_date, subtotal, discount, total, notes, created_by)
         VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4,$5,$6,$7,$8) RETURNING *`,
        [order_no, customer_id || null, order_date || null, subtotal, disc, total,
         notes || null, req.user.id]
      );
      for (const it of prepared) {
        await c.query(
          `INSERT INTO order_items (order_id, product_variant_id, batch_id, qty_units, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [rows[0].id, it.product_variant_id, it.batch_id || null,
           it.qty_units, it.unit_price, it.line_total]
        );
      }
      return rows[0];
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

/**
 * បញ្ជាក់ការលក់ → ដកស្តុកផលិតផលសម្រេច + ផ្តល់ពិន្ទុភក្ដីភាព
 * ត្រួតពិនិត្យស្តុកមុនដក — មិនទុកឱ្យលក់លើសអ្វីដែលមាន
 */
router.post('/:id/confirm', requireRole('sales'), async (req, res, next) => {
  try {
    const result = await withTransaction(async (c) => {
      const { rows: o } = await c.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
      const order = o[0];
      if (!order) { const e = new Error('រកមិនឃើញវិក្កយបត្រ'); e.status = 404; throw e; }
      if (order.status === 'confirmed') {
        const e = new Error('វិក្កយបត្រនេះបានបញ្ជាក់រួចហើយ'); e.status = 409; throw e;
      }
      if (order.status === 'cancelled') {
        const e = new Error('វិក្កយបត្រនេះត្រូវបានលុបចោល'); e.status = 409; throw e;
      }

      const { rows: items } = await c.query(
        'SELECT * FROM order_items WHERE order_id = $1', [req.params.id]
      );

      for (const it of items) {
        const { rows: st } = await c.query(
          `SELECT COALESCE(SUM(m.qty_change),0) AS qty, pv.sku, pv.name_km
           FROM product_variants pv
           LEFT JOIN inventory_movements m
             ON m.product_variant_id = pv.id AND m.item_kind = 'finished'
           WHERE pv.id = $1 GROUP BY pv.sku, pv.name_km`,
          [it.product_variant_id]
        );
        const available = Number(st[0]?.qty || 0);
        if (available < it.qty_units) {
          const e = new Error(
            `ស្តុក "${st[0]?.name_km || it.product_variant_id}" មិនគ្រប់គ្រាន់ ` +
            `(មាន ${available} កញ្ចប់ ត្រូវការ ${it.qty_units} កញ្ចប់)`
          );
          e.status = 409; throw e;
        }
        await c.query(
          `INSERT INTO inventory_movements
             (item_kind, product_variant_id, batch_id, qty_change, reason, ref_table, ref_id, created_by)
           VALUES ('finished', $1, $2, $3, 'sale', 'orders', $4, $5)`,
          [it.product_variant_id, it.batch_id || null, -Math.abs(it.qty_units),
           order.id, req.user.id]
        );
      }

      // ពិន្ទុភក្ដីភាព
      let pointsEarned = 0;
      if (order.customer_id) {
        const { rows: s } = await c.query(
          `SELECT value FROM settings WHERE key = 'loyalty_amount_per_point'`
        );
        const perPoint = Number(s[0]?.value ?? 10);
        pointsEarned = perPoint > 0 ? Math.floor(Number(order.total) / perPoint) : 0;
        if (pointsEarned > 0) {
          await c.query(
            `INSERT INTO loyalty_transactions (customer_id, order_id, points, reason, created_by)
             VALUES ($1,$2,$3,'ទទួលពីការទិញ',$4)`,
            [order.customer_id, order.id, pointsEarned, req.user.id]
          );
          await c.query(
            'UPDATE customers SET loyalty_points = loyalty_points + $2 WHERE id = $1',
            [order.customer_id, pointsEarned]
          );
        }
      }

      const { rows } = await c.query(
        `UPDATE orders SET status = 'confirmed' WHERE id = $1 RETURNING *`, [order.id]
      );
      await logAudit(c, { userId: req.user.id, action: 'confirm', table: 'orders',
                          recordId: order.id, newData: { total: order.total, pointsEarned } });
      return { ...rows[0], points_earned: pointsEarned };
    });
    res.json(result);
  } catch (e) { next(e); }
});

// កត់ត្រាការទូទាត់ពីអតិថិជន
router.post('/:id/payments', requireRole('sales', 'accountant'), async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ' });

    const result = await withTransaction(async (c) => {
      const { rows: o } = await c.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!o[0]) { const e = new Error('រកមិនឃើញវិក្កយបត្រ'); e.status = 404; throw e; }
      if (o[0].status !== 'confirmed') {
        const e = new Error('ត្រូវបញ្ជាក់វិក្កយបត្រជាមុនសិន'); e.status = 409; throw e;
      }
      const remaining = Number(o[0].total) - Number(o[0].paid_amount);
      if (amount > remaining + 0.001) {
        const e = new Error(`ទឹកប្រាក់លើសនៅសល់ (នៅសល់ ${remaining.toFixed(2)})`);
        e.status = 400; throw e;
      }
      await c.query(
        'INSERT INTO payments (order_id, amount, method, created_by) VALUES ($1,$2,$3,$4)',
        [req.params.id, amount, req.body.method || 'cash', req.user.id]
      );
      const { rows } = await c.query(
        `UPDATE orders o SET
           paid_amount = (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id = o.id),
           pay_status = CASE
             WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id = o.id) >= o.total THEN 'paid'
             WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id = o.id) > 0 THEN 'partial'
             ELSE 'unpaid' END::payment_status
         WHERE o.id = $1 RETURNING *`,
        [req.params.id]
      );
      return rows[0];
    });
    res.json(result);
  } catch (e) { next(e); }
});

/**
 * លុបចោលវិក្កយបត្រ — បើបញ្ជាក់រួច ស្តុកត្រឡប់មកវិញ និងដកពិន្ទុវិញ
 */
router.post('/:id/cancel', requireRole('admin'), async (req, res, next) => {
  try {
    if (!req.body.reason) return res.status(400).json({ error: 'ត្រូវការមូលហេតុលុបចោល' });

    const result = await withTransaction(async (c) => {
      const { rows: o } = await c.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
      const order = o[0];
      if (!order) { const e = new Error('រកមិនឃើញវិក្កយបត្រ'); e.status = 404; throw e; }
      if (order.status === 'cancelled') {
        const e = new Error('វិក្កយបត្រនេះលុបចោលរួចហើយ'); e.status = 409; throw e;
      }
      if (Number(order.paid_amount) > 0) {
        const e = new Error('មានការទូទាត់រួចហើយ — ត្រូវដោះស្រាយការសងប្រាក់ជាមុន');
        e.status = 409; throw e;
      }

      if (order.status === 'confirmed') {
        const { rows: items } = await c.query(
          'SELECT * FROM order_items WHERE order_id = $1', [order.id]
        );
        for (const it of items) {
          await c.query(
            `INSERT INTO inventory_movements
               (item_kind, product_variant_id, batch_id, qty_change, reason, ref_table, ref_id, note, created_by)
             VALUES ('finished', $1, $2, $3, 'sale_reversal', 'orders', $4, $5, $6)`,
            [it.product_variant_id, it.batch_id || null, Math.abs(it.qty_units),
             order.id, req.body.reason, req.user.id]
          );
        }
        if (order.customer_id) {
          const { rows: lp } = await c.query(
            `SELECT COALESCE(SUM(points),0) AS pts FROM loyalty_transactions WHERE order_id = $1`,
            [order.id]
          );
          const pts = Number(lp[0].pts);
          if (pts > 0) {
            await c.query(
              `INSERT INTO loyalty_transactions (customer_id, order_id, points, reason, created_by)
               VALUES ($1,$2,$3,'ដកវិញ ដោយលុបចោលវិក្កយបត្រ',$4)`,
              [order.customer_id, order.id, -pts, req.user.id]
            );
            await c.query(
              'UPDATE customers SET loyalty_points = GREATEST(loyalty_points - $2, 0) WHERE id = $1',
              [order.customer_id, pts]
            );
          }
        }
      }

      const { rows } = await c.query(
        `UPDATE orders SET status = 'cancelled',
           notes = COALESCE(notes || ' | ', '') || 'លុបចោល: ' || $2
         WHERE id = $1 RETURNING *`,
        [order.id, req.body.reason]
      );
      await logAudit(c, { userId: req.user.id, action: 'cancel', table: 'orders',
                          recordId: order.id, oldData: { status: order.status },
                          newData: { reason: req.body.reason } });
      return rows[0];
    });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
