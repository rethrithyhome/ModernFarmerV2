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
      'SELECT id, full_name, email, phone_e164, role, is_active, created_at FROM users ORDER BY id'
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

// បិទ/បើកគណនី
router.patch('/users/:id', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const { is_active, role } = req.body;
    const { rows } = await query(
      `UPDATE users SET is_active = COALESCE($2, is_active),
                        role = COALESCE($3::user_role, role),
                        updated_at = now()
       WHERE id = $1 RETURNING id, full_name, email, role, is_active`,
      [req.params.id, is_active ?? null, role ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'រកមិនឃើញអ្នកប្រើ' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
