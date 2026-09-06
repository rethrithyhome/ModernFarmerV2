import crypto from 'crypto';
import { query } from '../config/db.js';

/**
 * ការពារការធ្វើស្ទួន សម្រាប់សំណើដែលផ្ញើពី offline queue។
 *
 * លំហូរ:
 *   1. គ្មាន header `Idempotency-Key` → ដំណើរការធម្មតា
 *   2. មានលេខថ្មី → កត់ទុក 'in_progress' រួចដំណើរការ បញ្ចប់ហើយរក្សាចម្លើយ
 *   3. លេខដដែល ហើយធ្វើរួចហើយ → ឆ្លើយចម្លើយចាស់ភ្លាម (មិនធ្វើម្តងទៀត)
 *   4. លេខដដែល តែកំពុងដំណើរការ → 409 ឱ្យទូរស័ព្ទព្យាយាមក្រោយ
 *   5. លេខដដែល តែខ្លឹមសារខុសគ្នា → 422 (ការប្រើលេខខុស)
 *
 * កំហុសម៉ាស៊ីនមេ (5xx) មិនរក្សាទុកទេ ដើម្បីឱ្យផ្ញើម្តងទៀតបាន។
 * ការបដិសេធតាមវិធានអាជីវកម្ម (4xx ដូចជា ស្តុកមិនគ្រប់) រក្សាទុក
 * ព្រោះផ្ញើម្តងទៀតក៏ទទួលចម្លើយដដែល — ទូរស័ព្ទគួរឈប់ព្យាយាម។
 */
export async function idempotency(req, res, next) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return next();

  const key = req.headers['idempotency-key'];
  if (!key) return next();

  if (typeof key !== 'string' || key.length < 8 || key.length > 128) {
    return res.status(400).json({ error: 'Idempotency-Key មិនត្រឹមត្រូវ' });
  }

  const hash = crypto
    .createHash('sha256')
    .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? {})}`)
    .digest('hex');

  try {
    const { rows } = await query(
      `INSERT INTO idempotency_keys (key, user_id, method, path, request_hash)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [key, req.user?.id || null, req.method, req.originalUrl, hash]
    );

    if (rows.length === 0) {
      const { rows: prev } = await query(
        'SELECT * FROM idempotency_keys WHERE key = $1', [key]
      );
      const row = prev[0];

      if (row.request_hash && row.request_hash !== hash) {
        return res.status(422).json({
          error: 'លេខសម្គាល់សំណើនេះធ្លាប់ប្រើជាមួយទិន្នន័យផ្សេង',
        });
      }
      if (row.state === 'done') {
        res.setHeader('Idempotent-Replay', 'true');
        return res.status(row.status).json(row.response);
      }
      return res.status(409).json({
        error: 'សំណើនេះកំពុងដំណើរការ — សូមព្យាយាមម្តងទៀតបន្តិចទៀត',
      });
    }
  } catch (e) {
    return next(e);
  }

  // ចាប់យកចម្លើយ ដើម្បីរក្សាទុក
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode;
    if (status < 500) {
      query(
        `UPDATE idempotency_keys
         SET state = 'done', status = $2, response = $3, completed_at = now()
         WHERE key = $1`,
        [key, status, JSON.stringify(body)]
      ).catch((e) => console.error('idempotency store failed', e));
    } else {
      // ឱ្យផ្ញើម្តងទៀតបាន
      query('DELETE FROM idempotency_keys WHERE key = $1', [key])
        .catch((e) => console.error('idempotency cleanup failed', e));
    }
    return originalJson(body);
  };

  next();
}

/** លុបលេខចាស់ជាង ៧ ថ្ងៃ — ហៅពី cron ឬពេលចាប់ផ្តើមម៉ាស៊ីនមេ */
export async function purgeOldKeys(days = 7) {
  const { rowCount } = await query(
    `DELETE FROM idempotency_keys WHERE created_at < now() - ($1 || ' days')::interval`,
    [days]
  );
  return rowCount;
}
