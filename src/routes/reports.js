import express from 'express';
import { query } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authRequired);

/**
 * Dashboard សង្ខេប — សម្រាប់ទំព័រដើម និងសារ Telegram ប្រចាំថ្ងៃ
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    const [sales, monthSales, lowStock, finished, batches, ar] = await Promise.all([
      query(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
             FROM orders WHERE status='confirmed' AND order_date = $1`, [today]),
      query(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
             FROM orders WHERE status='confirmed' AND order_date >= $1`, [monthStart]),
      query('SELECT name_km, qty_kg, reorder_level_kg FROM v_raw_stock WHERE is_low ORDER BY qty_kg'),
      query('SELECT sku, name_km, qty_units FROM v_finished_stock ORDER BY qty_units'),
      query(`SELECT batch_code, status, planned_output_kg FROM production_batches
             WHERE status = 'in_progress' ORDER BY start_date`),
      query(`SELECT COALESCE(SUM(total - paid_amount),0) AS outstanding
             FROM orders WHERE status='confirmed' AND paid_amount < total`),
    ]);

    res.json({
      date: today,
      today: { orders: Number(sales.rows[0].orders), revenue: Number(sales.rows[0].revenue) },
      this_month: { orders: Number(monthSales.rows[0].orders), revenue: Number(monthSales.rows[0].revenue) },
      low_stock: lowStock.rows,
      finished_stock: finished.rows,
      active_batches: batches.rows,
      receivable_total: Number(ar.rows[0].outstanding),
    });
  } catch (e) { next(e); }
});

// ការលក់តាមផលិតផល
router.get('/sales-by-product', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM v_sales_by_variant ORDER BY revenue DESC');
    res.json(rows);
  } catch (e) { next(e); }
});

// អតិថិជនកំពូល
router.get('/top-customers', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM v_customer_summary WHERE order_count > 0
       ORDER BY lifetime_value DESC LIMIT $1`,
      [Math.min(Number(req.query.limit) || 20, 100)]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// អតិថិជនបាត់បង់ (មិនបានទិញយូរ) — សម្រាប់ការតាមដានឡើងវិញ
router.get('/dormant-customers', requireRole('sales'), async (req, res, next) => {
  try {
    const days = Number(req.query.days) || 90;
    const { rows } = await query(
      `SELECT * FROM v_customer_summary
       WHERE order_count > 0 AND days_since_last_order > $1
       ORDER BY lifetime_value DESC LIMIT 100`,
      [days]
    );
    res.json({ days_threshold: days, customers: rows });
  } catch (e) { next(e); }
});

/**
 * ព្យាករតាមរដូវកាល — មធ្យមភាគការលក់តាមខែ
 * ត្រូវការទិន្នន័យយ៉ាងតិច ១ ឆ្នាំ ទើបមានន័យ
 */
router.get('/seasonal', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM v_seasonal_sales ORDER BY product_name, month_no');
    const monthsKm = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា',
                      'កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
    res.json(rows.map((r) => ({ ...r, month_km: monthsKm[r.month_no - 1] })));
  } catch (e) { next(e); }
});

/**
 * តម្លៃដើមក្នុងមួយ batch — វត្ថុធាតុដើម + ចំណាយភ្ជាប់ + វេចខ្ចប់
 * ជួយកំណត់តម្លៃលក់ពេលចេញផលិតផលថ្មី
 */
router.get('/batch-cost/:id', requireRole('admin', 'accountant'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `WITH mat AS (
         SELECT pi.batch_id,
                SUM(pi.qty_kg * COALESCE((
                  SELECT AVG(pit.unit_price_kg) FROM purchase_items pit
                  WHERE pit.raw_material_id = pi.raw_material_id
                ), 0)) AS material_cost
         FROM production_inputs pi WHERE pi.batch_id = $1 GROUP BY pi.batch_id
       ),
       pkg AS (
         SELECT batch_id, SUM(packaging_cost) AS packaging_cost, SUM(qty_units) AS units
         FROM packaging_runs WHERE batch_id = $1 GROUP BY batch_id
       ),
       exp AS (
         SELECT batch_id, SUM(amount) AS other_cost
         FROM expenses WHERE batch_id = $1 GROUP BY batch_id
       )
       SELECT b.batch_code, b.actual_output_kg,
              COALESCE(mat.material_cost, 0)   AS material_cost,
              COALESCE(pkg.packaging_cost, 0)  AS packaging_cost,
              COALESCE(exp.other_cost, 0)      AS other_cost,
              COALESCE(mat.material_cost,0) + COALESCE(pkg.packaging_cost,0)
                + COALESCE(exp.other_cost,0)   AS total_cost,
              COALESCE(pkg.units, 0)           AS units_packed,
              CASE WHEN b.actual_output_kg > 0 THEN ROUND((
                COALESCE(mat.material_cost,0) + COALESCE(pkg.packaging_cost,0)
                + COALESCE(exp.other_cost,0)) / b.actual_output_kg, 4) END AS cost_per_kg,
              CASE WHEN COALESCE(pkg.units,0) > 0 THEN ROUND((
                COALESCE(mat.material_cost,0) + COALESCE(pkg.packaging_cost,0)
                + COALESCE(exp.other_cost,0)) / pkg.units, 2) END AS cost_per_unit
       FROM production_batches b
       LEFT JOIN mat ON mat.batch_id = b.id
       LEFT JOIN pkg ON pkg.batch_id = b.id
       LEFT JOIN exp ON exp.batch_id = b.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញ batch' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// អត្រាទិន្នផលគ្រប់ batch
router.get('/yield', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM v_batch_yield WHERE yield_pct IS NOT NULL ORDER BY batch_id DESC LIMIT 100'
    );
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
