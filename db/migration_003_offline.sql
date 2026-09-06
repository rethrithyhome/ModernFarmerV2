-- ============================================================
-- កសិករទំនើប — Migration 003
-- គាំទ្រការកត់ត្រាពេលអ៊ីនធឺណិតដាច់ (offline write queue)
--
-- បញ្ហា: ពេលបណ្តាញដាច់ពាក់កណ្តាល ទូរស័ព្ទមិនដឹងថាសំណើទៅដល់ម៉ាស៊ីនមេឬអត់។
--        បើផ្ញើម្តងទៀត ស្តុកអាចដកពីរដង។
-- ដំណោះស្រាយ: សំណើនីមួយៗមានលេខសម្គាល់តែមួយ (Idempotency-Key)។
--        ផ្ញើដដែលប៉ុន្មានដងក៏ដោយ ម៉ាស៊ីនមេធ្វើតែម្តង ហើយឆ្លើយចម្លើយដដែល។
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key          TEXT PRIMARY KEY,
  user_id      INT REFERENCES users(id),
  method       TEXT NOT NULL,
  path         TEXT NOT NULL,
  request_hash TEXT,
  state        TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | done
  status       INT,
  response     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_idem_created ON idempotency_keys (created_at);

COMMIT;
