/**
 * កត់ត្រាការកែប្រែសំខាន់ៗ — នរណាកែ អ្វី កាលណា
 * ហៅជាមួយ client ដដែលក្នុង transaction ដើម្បីឱ្យ rollback ជាមួយគ្នា
 */
export async function logAudit(client, { userId, action, table, recordId, oldData, newData }) {
  await client.query(
    `INSERT INTO audit_log (user_id, action, table_name, record_id, old_data, new_data)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId || null, action, table, recordId != null ? String(recordId) : null,
     oldData ? JSON.stringify(oldData) : null,
     newData ? JSON.stringify(newData) : null]
  );
}

/** បង្កើតលេខឯកសារតាមលំដាប់ ឧ. PO-2026-0001 */
export async function nextDocNo(client, { table, column, prefix }) {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT ${column} AS no FROM ${table}
     WHERE ${column} LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${year}-%`]
  );
  const last = rows[0]?.no;
  const seq = last ? parseInt(last.split('-').pop(), 10) + 1 : 1;
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
