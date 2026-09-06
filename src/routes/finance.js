import express from 'express';
import { query, withTransaction } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();
router.use(authRequired);

// ---------- ប្រភេទចំណាយ ----------
router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM expense_categories ORDER BY is_cogs DESC, name_km');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/categories', requireRole('admin'), async (req, res, next) => {
  try {
    const { name_km, is_cogs } = req.body;
    const { rows } = await query(
      'INSERT INTO expense_categories (name_km, is_cogs) VALUES ($1, COALESCE($2,false)) RETURNING *',
      [name_km, is_cogs ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'ប្រភេទនេះមានរួចហើយ' });
    next(e);
  }
});

// ---------- ចំណាយ ----------
router.get('/expenses', requireRole('accountant'), async (req, res, next) => {
  try {
    const { from, to, category_id, batch_id } = req.query;
    const { rows } = await query(
      `SELECT e.*, c.name_km AS category, c.is_cogs, a.name_km AS asset_name,
              b.batch_code, u.full_name AS created_by_name
       FROM expenses e
       JOIN expense_categories c ON c.id = e.category_id
       LEFT JOIN assets a ON a.id = e.asset_id
       LEFT JOIN production_batches b ON b.id = e.batch_id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE ($1::date IS NULL OR e.expense_date >= $1)
         AND ($2::date IS NULL OR e.expense_date <= $2)
         AND ($3::int  IS NULL OR e.category_id = $3)
         AND ($4::int  IS NULL OR e.batch_id = $4)
       ORDER BY e.expense_date DESC, e.id DESC LIMIT 300`,
      [from || null, to || null, category_id || null, batch_id || null]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/expenses', requireRole('accountant'), async (req, res, next) => {
  try {
    const { category_id, description, amount, expense_date, batch_id } = req.body;
    if (!category_id || !(Number(amount) >= 0)) {
      return res.status(400).json({ error: 'ត្រូវការប្រភេទចំណាយ និងចំនួនទឹកប្រាក់' });
    }
    const result = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO expenses (category_id, description, amount, expense_date, batch_id, created_by)
         VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE),$5,$6) RETURNING *`,
        [category_id, description || null, amount, expense_date || null,
         batch_id || null, req.user.id]
      );
      await logAudit(c, { userId: req.user.id, action: 'create', table: 'expenses',
                          recordId: rows[0].id, newData: { amount, category_id } });
      return rows[0];
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// ---------- ទ្រព្យ & រំលស់ ----------
router.get('/assets', requireRole('accountant'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.*,
              COALESCE((SELECT SUM(amount) FROM expenses WHERE asset_id = d.asset_id), 0) AS posted_to_date,
              d.purchase_cost - COALESCE((SELECT SUM(amount) FROM expenses WHERE asset_id = d.asset_id), 0)
                AS book_value
       FROM v_asset_depreciation d ORDER BY d.purchase_date DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/assets', requireRole('admin', 'accountant'), async (req, res, next) => {
  try {
    const { name_km, purchase_cost, purchase_date, useful_life_months, salvage_value } = req.body;
    if (!name_km || !(Number(purchase_cost) > 0) || !(Number(useful_life_months) > 0)) {
      return res.status(400).json({ error: 'ត្រូវការ ឈ្មោះ តម្លៃទិញ និងអាយុកាលប្រើប្រាស់ (ខែ)' });
    }
    const { rows } = await query(
      `INSERT INTO assets (name_km, purchase_cost, purchase_date, useful_life_months, salvage_value)
       VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4,COALESCE($5,0)) RETURNING *`,
      [name_km, purchase_cost, purchase_date || null, useful_life_months, salvage_value ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/**
 * ប្រកាសរំលស់ប្រចាំខែ — បង្កើតចំណាយស្វ័យប្រវត្តិសម្រាប់ទ្រព្យទាំងអស់ដែលនៅរំលស់
 * មាន unique index ការពារកុំឱ្យប្រកាសស្ទួនក្នុងខែតែមួយ
 * body: { month: "2026-09" }  (ស្រេចចិត្ត — លំនាំដើមខែបច្ចុប្បន្ន)
 */
router.post('/depreciation/post', requireRole('accountant'), async (req, res, next) => {
  try {
    const month = req.body.month
      ? `${req.body.month}-01`
      : new Date().toISOString().slice(0, 7) + '-01';

    const result = await withTransaction(async (c) => {
      const { rows: cat } = await c.query(
        `SELECT id FROM expense_categories WHERE name_km = 'រំលស់ទ្រព្យ'`
      );
      if (!cat[0]) { const e = new Error('រកមិនឃើញប្រភេទចំណាយ "រំលស់ទ្រព្យ"'); e.status = 400; throw e; }

      const { rows: assets } = await c.query(
        `SELECT * FROM v_asset_depreciation
         WHERE purchase_date <= $1::date AND $1::date < end_date`,
        [month]
      );

      const posted = [];
      const skipped = [];
      for (const a of assets) {
        const { rows } = await c.query(
          `INSERT INTO expenses (category_id, asset_id, description, amount, expense_date, period_month, created_by)
           VALUES ($1,$2,$3,$4,$5,$5,$6)
           ON CONFLICT (asset_id, period_month) WHERE asset_id IS NOT NULL DO NOTHING
           RETURNING *`,
          [cat[0].id, a.asset_id, `រំលស់ប្រចាំខែ — ${a.name_km}`,
           a.monthly_depreciation, month, req.user.id]
        );
        if (rows[0]) posted.push({ asset: a.name_km, amount: a.monthly_depreciation });
        else skipped.push({ asset: a.name_km, reason: 'បានប្រកាសរួចហើយក្នុងខែនេះ' });
      }
      return { month: month.slice(0, 7), posted, skipped,
               total: posted.reduce((s, p) => s + Number(p.amount), 0) };
    });
    res.json(result);
  } catch (e) { next(e); }
});

// ---------- ចំណេញ-ខាត ----------
router.get('/pnl', requireRole('accountant'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM v_monthly_pnl
       WHERE ($1::date IS NULL OR month >= $1) AND ($2::date IS NULL OR month <= $2)
       ORDER BY month DESC LIMIT 36`,
      [req.query.from || null, req.query.to || null]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// លុយជំពាក់ (អតិថិជនជំពាក់ + យើងជំពាក់អ្នកផ្គត់ផ្គង់)
router.get('/receivables', requireRole('accountant', 'sales'), async (req, res, next) => {
  try {
    const { rows: ar } = await query(
      `SELECT o.id, o.order_no, o.order_date, c.name AS customer_name, c.phone_display,
              o.total, o.paid_amount, (o.total - o.paid_amount) AS outstanding
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.status = 'confirmed' AND o.paid_amount < o.total
       ORDER BY o.order_date`
    );
    const { rows: ap } = await query(
      `SELECT p.id, p.purchase_no, p.purchase_date, s.name AS supplier_name,
              p.total_amount, p.paid_amount, (p.total_amount - p.paid_amount) AS outstanding
       FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.status = 'confirmed' AND p.paid_amount < p.total_amount
       ORDER BY p.purchase_date`
    );
    res.json({
      receivable: ar,
      receivable_total: ar.reduce((s, r) => s + Number(r.outstanding), 0),
      payable: ap,
      payable_total: ap.reduce((s, r) => s + Number(r.outstanding), 0),
    });
  } catch (e) { next(e); }
});

export default router;
