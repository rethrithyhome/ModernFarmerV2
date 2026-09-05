# ជំហានៗ — Supabase (SQL) + Vercel (Web app)

អានតាមលំដាប់ គ្រាន់តែ copy ពាក្យបញ្ជា/SQL ទៅដាក់កន្លែងរបស់វា។ អ្វីដែលអ្នកត្រូវការ:
GitHub 1 គណនី, Supabase 1 គណនី, Vercel 1 គណនី (សុទ្ធតែមាន plan ឥតគិតថ្លៃ)។

---

## ផ្នែក ១ — Supabase (មូលដ្ឋានទិន្នន័យ)

### ១.១ បង្កើត project

1. ចូល `supabase.com` → **Start your project** → ដាក់ឈ្មោះ project ឧ. `modern-farmer`
2. ជ្រើស Region ជិតកម្ពុជាបំផុត (Singapore) → តាំង password របស់ Database → **Create project**
3. រង់ចាំ ~១-២ នាទី រហូតដល់ project ប្រកាសថា ready

### ១.២ បង្កើតតារាង (run SQL)

1. ជ្រើស **SQL Editor** (ខាងឆ្វេង) → **New query**
2. បើកហ្វាយល៍ `supabase/schema.sql` របស់ project នេះ → copy **អស់ទាំងស្រុង** → ដាក់ក្នុង editor → **Run**
3. គួរឃើញ: `Success. No rows returned`
4. ផ្ទៀងផ្ទាត់: ជ្រើស **Table Editor** (ឆ្វេង) → ត្រូវមាន ១២ តារាង
   `app_meta, customers, lots, material_movements, materials, overheads, plans,
   process_logs, product_movements, products, qc_tests, recipes`
5. ឬ run ពាក្យបញ្ជានេះក្នុង SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by 1;
```

### ១.៣ យក URL + anon key

1. **Project Settings → Data API** (ឬ **Settings → API**)
2. ចម្លង **Project URL** → ឧ. `https://abcdefgh.supabase.co`
3. ចម្លង **anon public** key (ខ្សែវែង `eyJhbGci...`)
4. key នេះ *សាធារណៈ*ដោយ (RLS ការពារ) — កុំដាក់ `service_role` key ក្នុង app ដាច់ខាត

### ១.៤ កំណត់ workspace

- ក្នុង `supabase/schema.sql` មាន `workspace_id` (លំនាំដើម `plant-01`) ជាអ្នកបំបែកទិន្នន័យ
- បើមានរោងចក្រតែមួយ ទុក `plant-01`
- បើចង់ប្តូរ: កែក្នុង `cloud/schema.json` ជុំវិញ? អត់ — គ្រាន់តែ run ឡើងវិញជាមួយតម្លៃថ្មី:

```bash
# បង្កើត schema.sql ដែល baked នឹង workspace_id ផ្សេង
WORKSPACE=my-farm-01 node scripts/gen-sql.mjs
# រួច run supabase/schema.sql ឡើងវិញក្នុង SQL Editor (មានសុវត្ថិភាព ព្រោះ if not exists)
```

### ១.៥ (Optional) យកទិន្នន័យចាស់ចូល

បើអ្នកធ្លាប់ប្រើ app រួច (ទំព័រ ទិន្នន័យ/ការកំនត់ → ទាញយក JSON):

```bash
npm run sync:import ../my-export-2026-09-05.json
# បានហ្វាយល៍ supabase/import.sql
```

រួច copy `supabase/import.sql` ទាំងអស់ → SQL Editor → **Run**។
ចំណាំ: វា `ON CONFLICT DO UPDATE` ដូច្នេះ run ម្តងទៀតបាន មិនបង្កើតជួរដេកខ្ទង់។

### ១.៦ បង្កើតគណនីចូលប្រើប្រាស់ (Login) + កំណត់សិទ្ធិ (Role)

កម្មវិធីនេះទាមទារឲ្យចូលគណនីជានិច្ច នៅពេលដែល Supabase ត្រូវបានភ្ជាប់ (RLS បដិសេធ `anon`
ទាំងស្រុង — សូមមើល `scripts/gen-sql.mjs`)។ ហើយគណនីនីមួយៗត្រូវការ **role** ដើម្បីកែទិន្នន័យបាន៖

1. Supabase dashboard → **Authentication → Users** → **Add user** → **Create new user**
2. បញ្ចូល email + password (ជ្រើស **Auto Confirm User** ✅ ដើម្បីចូលបានភ្លាមដោយមិនចាំបាច់
   confirm email) → ចម្លង **User UID** ដែលបង្ហាញ
3. ចូល **SQL Editor** → កំណត់ role ឲ្យគណនីនោះ៖

```sql
insert into profiles (id, role) values ('<User UID ចម្លងពីជំហានទី ២>', 'admin');
-- role ជ្រើសមួយ: 'admin' (គ្រប់យ៉ាង) · 'stock' (ស្តុក/រូបមន្ត/Lot/QC/គម្រោង) · 'sale' (លក់/អតិថិជន)
```

4. ធ្វើម្តងទៀតសម្រាប់សហការី/បុគ្គលិកនាក់ផ្សេងទៀត — ជ្រើស role តាមតួនាទីការងារពិត

> មិនមាន "ចុះឈ្មោះខ្លួនឯង" ក្នុង app ទេ — admin បង្កើតគណនី + កំណត់ role ឲ្យតាម Supabase
> dashboard ប៉ុណ្ណោះ (សុវត្ថិភាពជាង សម្រាប់ក្រុមហ៊ុនតូច)។ គណនីដែលមិនទាន់កំណត់ role
> (មិនទាន់ insert ចូល `profiles`) នឹងឃើញសារ "មិនទាន់មានសិទ្ធិកំណត់" ពេលចូល — មិនមែន error ទេ
> គ្រាន់តែរង់ចាំ admin កំណត់ role ឲ្យ។ `admin` អាចប្តូរ role នរណាម្នាក់ពេលក្រោយ ដោយ update
> ជួរដេកនោះក្នុង `profiles` ដដែល។

| Role | ឃើញ/កែបាន |
|---|---|
| `admin` | គ្រប់ទំព័រ + គ្រប់សិទ្ធិទាំងអស់ |
| `stock` | សង្ខេប · ស្តុក · រូបមន្ត · Lot · ស្លាក QR · គម្រោង · គុណភាព · ផលិតផល |
| `sale` | សង្ខេប · អតិថិជន · ផលិតផល |

សិទ្ធិត្រូវបានអនុវត្តពិតនៅកម្រិត **database (RLS)** មិនមែននៅ UI ប៉ុណ្ណោះទេ — សូម្បីតែហៅ API
ដោយផ្ទាល់ក៏ត្រូវគោរព role ដដែរ។ ចង់ផ្លាស់ប្តូរថាតារាងណាមួយ role អាចកែបាន៖ កែ `writeRoles`
ក្នុង `cloud/schema.json` → `node scripts/gen-sql.mjs` → run `supabase/schema.sql` ឡើងវិញ។

---

## ផ្នែក ២ — ដំណើរការក្នុងម៉ាស៊ីនរបស់អ្នក

```bash
npm install
cp .env.example .env.local      # ដាក់ URL + anon key (មិនទាមទារទេ)
npm run dev                    # http://localhost:3000
```

- បើមិនដាក់ `.env.local` សោះ: app នៅដំណើរការ ដោយរក្សាទុកក្នុង browser មួយ **គ្មានចាំបាច់ login**
- ឬដាក់តាម app បាន: **ទិន្នន័យ/ការកំនត់ → Sync ជាមួយ Supabase** → បញ្ចូល URL + anon key +
  workspace → «រក្សាទុក ហើយភ្ជាប់»។ បើ cloud ទទេ វានឹង **ផ្ញើទិន្នន័យរបស់អ្នកឡើង** ម្តងទាំងស្រុង។
  ពេលនេះទំព័រ **ចូលប្រើប្រាស់** នឹងបង្ហាញភ្លាម — ប្រើ email/password ដែលបានបង្កើតនៅ ១.៦

ពិនិត្យថា sync ដំណើរការ: ក្នុង Supabase → SQL Editor:

```sql
select count(*) from materials;
select count(*), max(updated_at) from lots;
```

### សាកល្បងដោយគ្មាន Supabase (mock server)

```bash
npm run db:local        # http://127.0.0.1:54321
# ក្នុង app: URL = http://127.0.0.1:54321
#           anon key = fake-anon-key-for-local-testing-0123456789
```

ផ្ទាំង Settings នឹងបង្ហាញ «បានទាញយក N ជួរដេក» ហើយ `.data/fake-db.json` ផ្ទុកជួរដេកពិត។
លុប `.data/` ដើម្បីចាប់ផ្តើមឡើងវិញ។ ទំព័រ **ចូលប្រើប្រាស់** ក៏នឹងបង្ហាញដែរ — email/password
ណាមួយចូលបាន (mock នេះមិនផ្ទៀងផ្ទាត់ពិតទេ ប្រើសម្រាប់សាកល្បងក្នុងម៉ាស៊ីនតែប៉ុណ្ណោះ)។

---

## ផ្នែក ៣ — Vercel (hosting)

### ៣.១ ដាក់លើ GitHub

```bash
git init
git add .
git commit -m "ដីជី app: Supabase + Vercel"
gh repo create modern-farmer-compost --private --source=. --push
# ឬ upload ឡើក GitHub website ដោយដៃ
```

### ៣.២ Import ចូល Vercel

1. ចូល `vercel.com` → **Add New… → Project** → **Import Git Repository** (ជ្រើស repo របស់អ្នក)
2. Framework Preset: **Vite** (វា auto-detect) · Build Command `npm run build` · Output `dist`
3. ក្រោម **Environment Variables** ដាក់ ៣ តម្លៃ (Production + Preview):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` (anon public) |
| `VITE_SUPABASE_WORKSPACE` | `plant-01` (ឬដែលអ្នកដាក់) |

4. **Deploy** → រង់ចាំ ~១ នាទី → បាន URL ឧ. `https://modern-farmer.vercel.app`
5. **Domains** → អាចភ្ជាប់ domain របស់អ្នកឯង (ឧ. `deejii.com.kh`) ក្រោង After DNS

### ៣.៣ បើមិនដាក់ env vars បានទេ?

បាន — app ដំណើរការភ្លាម ប៉ុន្តែជា mode «រក្សាក្នុងឧបករណ៍»។
អ្នកប្រើនីមួយៗអាចដាក់ URL/key ខ្លួនឯងក្នុង **ទិន្នន័យ/ការកំនត់ → Sync ជាមួយ Supabase**
(វត្ថុទាំងនោះរក្សានៅ `localStorage` មិនមែនក្នុង code)។
ដាក់ env vars មានប្រយោជន៍ពេលអ្នកចង់ឱ្យគ្រប់គ្នាភ្ជាប់ base តែមួយភ្លាមដែលបើក។

### ៣.៤ ពិនិត្យក្រោយ deploy

1. បើក URL → ជ្រើស «ទិន្នន័យគំរូ» (ឬ «ទិន្នន័យទទេ»)
2. បើដាក់ env var រួច: ផ្ទាំងសង្ខេបត្រូវបង្ហាញ **cloud ✓** ក្នុងថ្នាំងខាងឆ្វេង
3. បង្កើត Lot ថ្មីមួយ → បើក Supabase Table Editor → ជួរដេកថ្មីនៅ `lots` លេចឡើងក្នុង ~១s
4. បើក URL ដដែលលើទូរស័ព្ទ (URL/key តែមួយ) → Lot នោះបង្ហាញ (polling រៀងរាល់ ៤៥s ឬពេលបិទ/បើក tab)
5. សាកល្បង QR: ផ្ទាំង «ស្លាក QR» → បោះពុម្ព → ស្កេនដោយទូរស័ព្ទ → បើកទំព័រLot នោះ

---

## ផ្នែក ៤ — សុវត្ថិភាព (សូមអាន)

- Anon key + RLS policy `to anon` = **អ្នកណាមាន URL + key អាចអាន/សរសេរWorkspace` ដូចគ្នា**។
  គ្រាន់តែលាក់ URL មិនមែនជាការការពារពិតប្រាកដទេ (key បង្ហាញខ្លួនក្នុង browser)។
- បើចង់កំណត់តែបុគ្គលិក: បន្ថែម **Supabase Auth** (email/password ឬ Magic Link) rួចកែ policy
  ពី `to anon` ទៅ `to authenticated`។ រចនាសម្ព័ន្ធបច្ចុប្បន្ន ធ្វើឱ្យ transition នោះងាយ:
  រាល់តារាងមាន `workspace_id` រួចហើយ គ្រាន់តែបន្ថែម `owner_id`។
- បម្រុងទុក: app មាន **ទាញយក JSON** (រួមទាំង timestamp) — ទាញយកជាប្រចាំ, ឬ
  run `INSERT INTO … SELECT …` export ក្នុង Supabase (Continuous Restores / PITR លើ plan Pro)។

## ផ្នែក ៥ — ផ្លាស់ប្តូររចនាសម្ព័ន្ធ (ឧ. បន្ថែមជួរដេកថ្មី)

1. កែ `cloud/schema.json` (បន្ថែម `{ field, column, type }`)
2. កែ type ពាក់ព័ន្ធក្នុង `src/lib/types.ts` + ប្រើវាក្នុង UI
3. `npm run gen:sql && npm test`
4. run `supabase/schema.sql` ឡើងវិញក្នុង SQL Editor (វា `create table if not exists` —
   ប៉ុន្តែ `alter table add column` មិន auto ទេ; បើបន្ថែមជួរដេកថ្មី សូម run:

```sql
alter table lots add column if not exists new_field text;
```

5. commit/push → Vercel deploy ឡើងវិញ (auto)

## ឧបសគ្គដែលជួបញឹកញាប់

| សញ្ញា | មូលហេតុ | ដំណោះស្រាយ |
|---|---|---|
| «មិនអាចភ្ជាប់បាន: Supabase បដិសេធ» | មិនទាន់ run schema.sql ឬ key ខុស | run ឡើងវិញ · មើល Table Editor |
| «រង់ចាំ N» នៅជានិច្ច | network ឬ project paused | បើក Supabase project (pause ក្រោយ ៧ ថ្ងៃអសកម្ម) |
| ទិន្នន័យមិនហូរចូលគ្នា | workspace ខុសគ្នា | កែ URL/key/workspace ឱ្យដូចគ្នាគ្រប់ device |
| បង្ហាញ «No dataset» | មិនទាន់ចុច first-run choice | ជ្រើស គំរូ/ទទេ |
| Vercel build fail: tsc error | env var ខ្វះ | ដាក់ VITE_* ឱ្យមាន ឬទទេក៏បាន (code អាន `?? ""`) |
| ចង់ reset ទាំងស្រុង |  | SQL: `delete from lots; delete from material_movements; …` ឬប្រើ «សម្អាតទិន្នន័យ» ក្នុង Settings (នឹង sync តាម) |
