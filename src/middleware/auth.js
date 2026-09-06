import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

/**
 * RBAC ពិតប្រាកដ — ហាមឃាត់នៅកម្រិត API មិនមែនគ្រាន់តែលាក់ menu នៅ UI
 * (ចំណុចខ្សោយមួយនៃប្រព័ន្ធ Apps Script ចាស់)
 */

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'ត្រូវការចូលប្រព័ន្ធជាមុន' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'សម័យប្រើប្រាស់ផុតកំណត់ សូមចូលម្តងទៀត' });
  }

  /**
   * ត្រួតពិនិត្យគណនីពិតក្នុង database រាល់សំណើ។
   * បើមិនធ្វើ ការបិទគណនីមិនមានប្រសិទ្ធភាពរហូតដល់ token ផុតកំណត់។
   */
  try {
    const { rows } = await query(
      'SELECT id, role, full_name, is_active, password_changed_at FROM users WHERE id = $1',
      [payload.id]
    );
    const user = rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'គណនីនេះត្រូវបានបិទ' });
    }

    // Token ដែលចេញមុនការប្តូរពាក្យសម្ងាត់ លែងប្រើបាន
    const changedAtMs = new Date(user.password_changed_at).getTime();
    // token ចាស់គ្មាន `ms` — ប្រើចុងវិនាទីរបស់ iat ជំនួស (សុវត្ថិភាពខាងអនុញ្ញាត)
    const issuedMs = payload.ms ?? (payload.iat + 1) * 1000;
    if (changedAtMs > issuedMs) {
      return res.status(401).json({ error: 'ពាក្យសម្ងាត់ត្រូវបានប្តូរ សូមចូលម្តងទៀត' });
    }

    // យកតួនាទីពី database មិនមែនពី token — បើ admin ប្តូរតួនាទី វាមានប្រសិទ្ធភាពភ្លាម
    req.user = { id: user.id, role: user.role, name: user.full_name };
    next();
  } catch (e) {
    next(e);
  }
}

/** ឧ. requireRole('admin', 'stock') */
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'ត្រូវការចូលប្រព័ន្ធជាមុន' });
    if (req.user.role === 'admin') return next();          // admin ចូលបានគ្រប់កន្លែង
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'អ្នកគ្មានសិទ្ធិប្រើមុខងារនេះទេ' });
    }
    next();
  };
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.full_name,
      // `iat` ស្តង់ដាររាប់ជាវិនាទី — មិនល្អិតល្មមទេ។ បើប្តូរពាក្យសម្ងាត់
      // ក្នុងវិនាទីតែមួយនឹងការចេញ token នោះការប្រៀបធៀបនឹងខុស។
      // ដូច្នេះរក្សាពេលវេលាជាមិល្លីវិនាទីដោយឡែក។
      ms: Date.now(),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}
