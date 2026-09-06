import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { authRequired, requireRole, signToken } from '../middleware/auth.js';
import { requireValidPhone } from '../utils/phone.js';

const router = express.Router();

// ចូលប្រព័ន្ធ
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់' });
    }
    const { rows } = await query(
      'SELECT * FROM users WHERE lower(email) = lower($1) AND is_active = TRUE',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ' });
    }
    res.json({
      token: signToken(user),
      user: { id: user.id, name: user.full_name, email: user.email, role: user.role },
    });
  } catch (e) { next(e); }
});

// ព័ត៌មានអ្នកប្រើបច្ចុប្បន្ន
router.get('/me', authRequired, (req, res) => res.json({ user: req.user }));

// បញ្ជីអ្នកប្រើ (admin តែប៉ុណ្ណោះ)
router.get('/users', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, full_name, email, phone_e164, role, is_active, created_at, password_changed_at
       FROM users ORDER BY is_active DESC, id`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// បង្កើតអ្នកប្រើថ្មី
router.post('/users', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const { full_name, email, password, role, phone } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'ត្រូវការ ឈ្មោះ អ៊ីមែល និងពាក្យសម្ងាត់' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួ' });
    }
    const p = requireValidPhone(phone);
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (full_name, email, password_hash, role, phone_e164)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, full_name, email, role, is_active`,
      [full_name, email, hash, role || 'sales', p.e164]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'អ៊ីមែលនេះមានរួចហើយ' });
    next(e);
  }
});

// បិទ/បើកគណនី និងប្តូរតួនាទី
router.patch('/users/:id', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    const { is_active, role, full_name } = req.body;

    /**
     * ការពារកុំឱ្យ admin ចាក់សោខ្លួនឯងចេញ
     * (បញ្ហាដែលកើតឡើងញឹកញាប់ ហើយស្តារវិញពិបាក)
     */
    if (targetId === req.user.id) {
      if (is_active === false) {
        return res.status(400).json({ error: 'មិនអាចបិទគណនីខ្លួនឯងបានទេ' });
      }
      if (role && role !== 'admin') {
        return res.status(400).json({ error: 'មិនអាចបន្ថយសិទ្ធិខ្លួនឯងបានទេ' });
      }
    }

    // ត្រូវនៅសល់ admin យ៉ាងតិចម្នាក់ដែលនៅដំណើរការ
    if (is_active === false || (role && role !== 'admin')) {
      const { rows: t } = await query('SELECT role, is_active FROM users WHERE id = $1', [targetId]);
      if (!t[0]) return res.status(404).json({ error: 'រកមិនឃើញអ្នកប្រើ' });

      if (t[0].role === 'admin' && t[0].is_active) {
        const { rows: c } = await query(
          `SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_active = TRUE`
        );
        if (c[0].n <= 1) {
          return res.status(400).json({
            error: 'នេះជា admin ចុងក្រោយ — បង្កើត admin ម្នាក់ទៀតជាមុនសិន',
          });
        }
      }
    }

    const { rows } = await query(
      `UPDATE users SET is_active = COALESCE($2, is_active),
                        role = COALESCE($3::user_role, role),
                        full_name = COALESCE($4, full_name),
                        updated_at = now()
       WHERE id = $1 RETURNING id, full_name, email, role, is_active`,
      [targetId, is_active ?? null, role ?? null, full_name ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញអ្នកប្រើ' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/**
 * Admin កំណត់ពាក្យសម្ងាត់ថ្មីឱ្យបុគ្គលិក (ពេលភ្លេច)
 * Token ចាស់របស់អ្នកប្រើនោះលែងប្រើបានភ្លាម
 */
router.patch('/users/:id/password', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password || String(new_password).length < 8) {
      return res.status(400).json({ error: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួ' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    const { rows } = await query(
      `UPDATE users SET password_hash = $2, password_changed_at = now(), updated_at = now()
       WHERE id = $1 RETURNING id, full_name, email`,
      [req.params.id, hash]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញអ្នកប្រើ' });
    res.json({ ...rows[0], message: 'ប្តូរពាក្យសម្ងាត់រួចរាល់ — អ្នកប្រើត្រូវចូលម្តងទៀត' });
  } catch (e) { next(e); }
});

/** អ្នកប្រើប្តូរពាក្យសម្ងាត់ខ្លួនឯង — ត្រូវដឹងពាក្យសម្ងាត់ចាស់ */
router.post('/me/password', authRequired, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'ត្រូវការពាក្យសម្ងាត់ចាស់ និងថ្មី' });
    }
    if (String(new_password).length < 8) {
      return res.status(400).json({ error: 'ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៨ តួ' });
    }

    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0] || !(await bcrypt.compare(current_password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'ពាក្យសម្ងាត់ចាស់មិនត្រឹមត្រូវ' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await query(
      `UPDATE users SET password_hash = $2, password_changed_at = now(), updated_at = now()
       WHERE id = $1`,
      [req.user.id, hash]
    );
    res.json({ message: 'ប្តូរពាក្យសម្ងាត់រួចរាល់ — សូមចូលម្តងទៀត' });
  } catch (e) { next(e); }
});

export default router;
