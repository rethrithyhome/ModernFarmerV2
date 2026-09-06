import jwt from 'jsonwebtoken';

/**
 * RBAC ពិតប្រាកដ — ហាមឃាត់នៅកម្រិត API មិនមែនគ្រាន់តែលាក់ menu នៅ UI
 * (ចំណុចខ្សោយមួយនៃប្រព័ន្ធ Apps Script ចាស់)
 */

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'ត្រូវការចូលប្រព័ន្ធជាមុន' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'សម័យប្រើប្រាស់ផុតកំណត់ សូមចូលម្តងទៀត' });
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
    { id: user.id, role: user.role, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}
