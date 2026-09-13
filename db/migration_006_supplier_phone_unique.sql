-- ============================================================
-- កសិករទំនើប — Migration 006
-- លេខទូរស័ព្ទអ្នកផ្គត់ផ្គង់មិនត្រូវស្ទួនគ្នា
--
-- ប្រព័ន្ធចាស់អនុញ្ញាតឱ្យលេខទូរស័ព្ទស្ទួនគ្នាបាន ដែលធ្វើឱ្យបង្កើតអ្នកផ្គត់ផ្គង់
-- ត្រូវគ្នាឡើងវិញដោយចៃដន្យ។ Migration នេះបន្ថែម constraint ការពារកុំឱ្យស្ទួន
-- ទៀតនាពេលអនាគត។
--
-- ⚠️ បើមានទិន្នន័យស្ទួនរួចហើយ constraint នឹង**មិនបង្កើតទេ** (migration នៅតែ
-- ជោគជ័យ មិនគាំង) — ប្រព័ន្ធនឹងបង្ហាញសារ NOTICE ប្រាប់ឱ្យសម្អាតទិន្នន័យមុន។
-- មើល query ខាងក្រោមដើម្បីរកឯកសារស្ទួន។
-- ============================================================

BEGIN;

DO $$
BEGIN
  CREATE UNIQUE INDEX idx_supplier_phone ON suppliers (phone_e164) WHERE phone_e164 IS NOT NULL;
  RAISE NOTICE '✅ បង្កើត constraint រួចរាល់ — លេខទូរស័ព្ទអ្នកផ្គត់ផ្គង់ឥឡូវមិនអាចស្ទួនគ្នាទៀតទេ';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE '⚠️  មានលេខទូរស័ព្ទស្ទួនរួចហើយក្នុងទិន្នន័យបច្ចុប្បន្ន — constraint មិនទាន់បង្កើតទេ។';
  RAISE NOTICE '    រត់ query នេះដើម្បីរកអ្នកផ្គត់ផ្គង់ស្ទួន រួចសម្រួចមុនរត់ migration នេះម្តងទៀត:';
  RAISE NOTICE '    SELECT phone_e164, array_agg(id) AS supplier_ids, array_agg(name) AS names';
  RAISE NOTICE '    FROM suppliers WHERE phone_e164 IS NOT NULL';
  RAISE NOTICE '    GROUP BY phone_e164 HAVING COUNT(*) > 1;';
END $$;

COMMIT;
