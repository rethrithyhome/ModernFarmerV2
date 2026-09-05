# កសិករទំនើប · Modern Farmer — ប្រព័ន្ធគ្រប់គ្រងផលិតកម្មជីកំប៉ុស្តិ៍

Vite + React + TypeScript ។ រក្សាទុកទិន្នន័យក្នុង browser (ដំណើរការភ្លាម គ្មាន backend)
ហើយ **អាច** ភ្ជាប់ Supabase (Postgres) ដើម្បីឱ្យគ្រប់ទូរស័ព្ទ/កុំព្យូទ័រឃើញទិន្នន័យតែមួយ។

## មុខងារ

| ផ្ទាំង | អ្វីដែលធ្វើបាន |
|---|---|
| ផ្ទាំងសង្ខេប | ថ្លៃដើមពិត/គ.ក · ទិនន្ទ័ផលខែ · ដំនៅការផែនការ · សល់ជំពាក់ · ផែជារបៀង |
| ស្តុកវត្ថុធាតុ | ទិញចូល · រាប់ស្តុក · ប្រវត្តិចលនា (ស្តុកគណនាពីចលនាជានិច្ច) |
| រូបមន្ត | BOM · C:N · NPK រូបមន្ត · ដែនកំណត់ QC · ថ្លៃដើម/Lot |
| Lot ផលិតកម្ម | បើក Lot (កាត់ស្តុក) · បន្ថែមវត្ថុធាតុកណ្តាលផ្កាម · កំណត់សង្កេត (កំដៅ/សំណើម/pH/ការកូរ) · ផ្អាក/បដិសេធ/បញ្ចប់ |
| ស្លាក QR | ជ្រើស Lot → បោះពុម្ពស្លាក (QR បើកទំព័រLot នោះ) |
| គម្រោងប្រចាំខែ | គោលដៅ គ.ក · បញ្ចប់ + រំពឹង vs គោលដៅ · **បញ្ជីទិញវត្ថុធាតុ + ថវិកា** · ចំណាយរួមរោងចក្រ |
| គុណភាព | តេស្តកណ្តាល/ចុងក្រោយ · វិនិច្ឆ័យជាប់-ចាញ់ស្វ័យប្រវត្តិ · ថ្នាក់ A/B/C |
| អតិថិជន | សៀវភៅអតិថិជន · ប្រវត្តិទិញ · វិក្កយបត្រ · ការបង់ប្រាក់ · អាយុជំពាក់ |
| ផលិតផល | ថ្លៃ A/B/C · បញ្ចេញលក់ភ្ជាប់ Lot · វិក្កយបត្របោះពុម្ព · របាយការណ៍ |
| របាយការណ៍ | ថ្លៃដើមតាមLot (ផ្ទាល់ + បែងចែកចំណាយរួម) · ខែៗ · គម្រោង vs ជាក់ស្តែង · បំណុលអតិថិជន · បោះពុម្ព/PDF |

## ដំណើរការភ្លាម (គ្មាន Supabase)

```bash
npm install
npm run dev        # http://localhost:3000
```

## ភ្ជាប់ Supabase ខ្លីៗ

1. បង្កើត project លើ [supabase.com](https://supabase.com) រួច SQL editor → ដាក់ខ្លឹមសារ
   `supabase/schema.sql` ទាំងអស់ → Run។
2. ក្នុង app: **ទិនន្ទ័យ/ការកំនត់ → Sync ជាមួយ Supabase** → បញ្ចូល *Project URL* +
   *anon key* + *Workspace id* (ដូចក្នុង schema.sql, លំនាំដើម `plant-01`) → រក្សាទុក ហើយភ្ជាប់។
3. បើអ្នកមានទិនន្ទ័យចាស់ជា JSON ពី app នេះ ហើយចង់យកចូល Postgres:
   `npm run sync:import path/to/export.json` → បាន `supabase/import.sql` → run ក្នុង SQL editor។

> ព័ត៌មានពេញលេញ (រួមទាំង Vercel, RLS, សុវត្ថិភាព, ការផ្លាស់ប្តូរតារាង) នៅ
> [`docs/RUN-Supabase-Vercel-KM.md`](docs/RUN-Supabase-Vercel-KM.md)។

## Scripts

| ពាក្យបញ្ជា | អត្ថន័យ |
|---|---|
| `npm run dev` / `build` / `preview` | Vite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | ១០ ការពិនិត្យ mapping/diff/schema (Node, គ្មានបណ្តាញ) |
| `npm run gen:sql` | បង្កើត `supabase/schema.sql` ពី `cloud/schema.json` |
| `npm run check:sql` | ពិនិត្យថា SQL មិនខុសពី JSON និយមន័យ |
| `npm run db:local` | Supabase-mock ក្នុងម៉ាស៊ីន (`http://127.0.0.1:54321`) សម្រាប់សាកល្បង sync |
| `npm run sync:import <file.json>` | export JSON → `supabase/import.sql` |

## រចនាសម្ព័ន្ធ

```
cloud/schema.json        ប្រភពតែមួយសម្រាប់ ១១ តារាង + ឈ្មោះជួរដេក (camel ↔ snake_case)
src/lib/schema.generated.ts   ← បង្កើតដោយ gen-sql.mjs (កុំកែដោយដៃ)
src/lib/cloud.ts         អាន/សរសេរតារាង + ការកំណត់ Supabase (URL/key/workspace)
src/lib/syncPlan.ts      diff ពីរ snapshots → upsert/delete + ដំណាក់ mapping
src/lib/sync.ts          queue + retry + polling + ពេលភ្ជាប់/pull
supabase/schema.sql      run ក្នុង Supabase SQL editor
scripts/                 gen-sql · import-json · fake-postgrest (mock Supabase)
tests/                   node --test mapping/diff/schema-drift
```

ការរក្សាទុក៖ រាល់ការកែប្រែមួយ → ចូល `localStorage` ភ្លាម (UI ឆាប់រហ័ស) ហើយបណ្តុំផ្លាស់ប្តូរ
ត្រូវផ្ញើទៅ Supabase ក្នុងផ្ទៃខាងក្រោយ (~0.7s debounce, retry ពេលបណ្តាញខូច)។ ដូច្នេះ app
នៅប្រើបានពេលអិនធឺណិតដាច់ ហើយបន្ត sync ខ្លួនឯង។
