import express from 'express';
import { query, withTransaction } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { requireValidPhone } from '../utils/phone.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();
router.use(authRequired);

// បញ្ជីអតិថិជន + សង្ខេបការទិញ
router.get('/', async (req, res, next) => {
  try {
    const { search, ctype, limit } = req.query;
    const { rows } = await query(
      `SELECT s.*, c.address, c.province, c.notes, c.is_active
       FROM v_customer_summary s
       JOIN customers c ON c.id = s.customer_id
       WHERE ($1::text IS NULL OR s.name ILIKE '%'||$1||'%' OR c.phone_e164 ILIKE '%'||$1||'%')
         AND ($2::text IS NULL OR s.ctype::text = $2)
       ORDER BY s.lifetime_value DESC
       LIMIT $3`,
      [search || null, ctype || null, Math.min(Number(limit) || 100, 500)]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// លម្អិត + ប្រវត្តិការទិញ + ប្រវត្តិពិន្ទុ
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: c } = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!c[0]) return res.status(404).json({ error: 'រកមិនឃើញអតិថិជន' });

    const { rows: orders } = await query(
      `SELECT id, order_no, order_date, total, paid_amount, pay_status, status
       FROM orders WHERE customer_id = $1 ORDER BY order_date DESC LIMIT 50`,
      [req.params.id]
    );
    const { rows: loyalty } = await query(
      `SELECT points, reason, created_at FROM loyalty_transactions
       WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ ...c[0], orders, loyalty });
  } catch (e) { next(e); }
});

// បង្កើតអតិថិជន — លេខទូរស័ព្ទស្ទួនត្រូវបដិសេធ
router.post('/', requireRole('sales'), async (req, res, next) => {
  try {
    const { name, phone, ctype, address, province, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'ត្រូវការឈ្មោះអតិថិជន' });
    const p = requireValidPhone(phone);
    const { rows } = await query(
      `INSERT INTO customers (name, phone_e164, phone_display, ctype, address, province, notes)
       VALUES ($1,$2,$3,COALESCE($4::customer_type,'retail'),$5,$6,$7) RETURNING *`,
      [name, p.e164, p.display, ctype || null, address || null, province || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'លេខទូរស័ព្ទនេះមានអតិថិជនរួចហើយ' });
    }
    next(e);
  }
});

router.patch('/:id', requireRole('sales'), async (req, res, next) => {
  try {
    const { name, phone, ctype, address, province, notes, is_active } = req.body;
    const p = phone !== undefined ? requireValidPhone(phone) : null;
    const { rows } = await query(
      `UPDATE customers SET
         name = COALESCE($2, name),
         phone_e164 = COALESCE($3, phone_e164),
         phone_display = COALESCE($4, phone_display),
         ctype = COALESCE($5::customer_type, ctype),
         address = COALESCE($6, address),
         province = COALESCE($7, province),
         notes = COALESCE($8, notes),
         is_active = COALESCE($9, is_active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name ?? null, p?.e164 ?? null, p?.display ?? null, ctype ?? null,
       address ?? null, province ?? null, notes ?? null, is_active ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញអតិថិជន' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'លេខទូរស័ព្ទនេះមានអតិថិជនរួចហើយ' });
    next(e);
  }
});

// ប្រើពិន្ទុភក្ដីភាព (ដូរជាការបញ្ចុះតម្លៃ)
router.post('/:id/redeem', requireRole('sales'), async (req, res, next) => {
  try {
    const points = Number(req.body.points);
    if (!Number.isInteger(points) || points <= 0) {
      return res.status(400).json({ error: 'ចំនួនពិន្ទុមិនត្រឹមត្រូវ' });
    }
    const result = await withTransaction(async (c) => {
      const { rows } = await c.query(
        'SELECT * FROM customers WHERE id = $1 FOR UPDATE', [req.params.id]
      );
      if (!rows[0]) { const e = new Error('រកមិនឃើញអតិថិជន'); e.status = 404; throw e; }
      if (rows[0].loyalty_points < points) {
        const e = new Error(`ពិន្ទុមិនគ្រប់គ្រាន់ (មាន ${rows[0].loyalty_points} ពិន្ទុ)`);
        e.status = 409; throw e;
      }
      const { rows: st } = await c.query(
        `SELECT value FROM settings WHERE key = 'loyalty_point_value'`
      );
      const pointValue = Number(st[0]?.value ?? 0.1);

      await c.query(
        `INSERT INTO loyalty_transactions (customer_id, points, reason, created_by)
         VALUES ($1,$2,'ដូរជាការបញ្ចុះតម្លៃ',$3)`,
        [req.params.id, -points, req.user.id]
      );
      const { rows: upd } = await c.query(
        'UPDATE customers SET loyalty_points = loyalty_points - $2 WHERE id = $1 RETURNING *',
        [req.params.id, points]
      );
      await logAudit(c, { userId: req.user.id, action: 'redeem_points', table: 'customers',
                          recordId: req.params.id, newData: { points } });
      return { customer: upd[0], discount_value: Number((points * pointValue).toFixed(2)) };
    });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
