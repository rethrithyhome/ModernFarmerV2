# របៀបដំឡើង — កសិករទំនើប

ឯកសារនេះណែនាំជាជំហានៗ ចាប់ពីម៉ាស៊ីនទទេ រហូតដល់ក្រុមការងារប្រើបានលើទូរស័ព្ទ។

មាន ៣ ជម្រើស៖

| ជម្រើស | សម្រាប់អ្វី | ត្រូវការ |
|---|---|---|
| **ក. សាកល្បងលើកុំព្យូទ័រខ្លួនឯង** | មើលមុនសម្រេចចិត្ត · បណ្តុះបណ្តាលក្រុមការងារ | កុំព្យូទ័រ ១ គ្រឿង |
| **ខ. ដំឡើងលើ VPS សម្រាប់ប្រើពិត** | គ្រប់គ្រងខ្លួនឯង ១០០% · តម្លៃថេរ | VPS + ដូមេន + ចេះ command line បន្តិច |
| **ង. Supabase + Vercel** | ចាប់ផ្តើមលឿន មិនចាំបាច់ចេះគ្រប់គ្រង server · មិនចាំបាច់ command line | គណនី GitHub + កាតទូទាត់ (មានផែនការឥតគិតថ្លៃ) |

**មិនច្បាស់ថាជ្រើសមួយណា?** ចាប់ផ្តើម **ង** ព្រោះលឿនបំផុត និងមិនចាំបាច់ចេះបច្ចេកទេសជ្រៅ។ ប្តូរទៅ **ខ** ពេលក្រោយបានលុះត្រាតែ traffic ច្រើន ឬចង់សន្សំថ្លៃ។

ចាប់ផ្តើមដោយ **ក** ដើម្បីស៊ាំមុន រួចធ្វើ **ខ** ពេលត្រៀមប្រើពិត។

---

# ក. សាកល្បងលើកុំព្យូទ័រខ្លួនឯង

## ក.១ ដំឡើងកម្មវិធីត្រូវការ

ត្រូវការ ២ យ៉ាង៖ **Node.js 20+** និង **PostgreSQL 14+**

**Windows**
1. ទាញយក Node.js ពី `nodejs.org` (យក LTS) → ដំឡើងធម្មតា
2. ទាញយក PostgreSQL ពី `postgresql.org/download/windows` → ដំឡើង
   - ពេលដំឡើងវានឹងសួរពាក្យសម្ងាត់សម្រាប់អ្នកប្រើ `postgres` — **កត់ទុក**
   - Port ទុក `5432` ដដែល

**macOS**
```bash
brew install node postgresql@16
brew services start postgresql@16
```

ពិនិត្យថាដំឡើងបានហើយ៖
```bash
node -v      # គួរបង្ហាញ v20 ឬលើសនេះ
psql --version
```

## ក.២ បង្កើត database

**Windows** — បើក "SQL Shell (psql)" ពី Start Menu រួចវាយ៖
```sql
CREATE DATABASE modern_farmer;
```

**macOS/Linux**
```bash
createdb modern_farmer
```

## ក.៣ រៀបចំកម្មវិធី

បើកបង្អួច Terminal (Windows: PowerShell) នៅក្នុងថតកម្មវិធី៖

```bash
# ១. ដំឡើង dependencies របស់ backend
npm install

# ២. ចម្លងឯកសារកំណត់
cp .env.example .env          # Windows: copy .env.example .env
```

បើក `.env` ដោយ Notepad ឬកម្មវិធីណាមួយ រួចកែ ២ បន្ទាត់៖

```
DATABASE_URL=postgres://postgres:ពាក្យសម្ងាត់របស់អ្នក@localhost:5432/modern_farmer
JWT_SECRET=អក្សរចៃដន្យវែងយ៉ាងតិច ៣២ តួ
```

> `JWT_SECRET` ជាកូនសោសម្ងាត់។ វាយអក្សរ លេខ ចម្រុះគ្នាឱ្យវែង។ បើមាន Terminal លើ macOS/Linux អាចបង្កើតដោយ `openssl rand -base64 48`។

បន្ត៖
```bash
# ៣. បង្កើតតារាងទាំងអស់
npm run migrate

# ៤. បញ្ចូលទិន្នន័យដំបូង និងគណនី admin
npm run seed

# ៥. Build ផ្ទាំងប្រើប្រាស់
cd web
npm install
npm run build
cd ..

# ៦. ចាប់ផ្តើម
npm start
```

បើឃើញ `✅ កសិករទំនើប ដំណើរការនៅ http://localhost:3000` គឺរួចរាល់។

បើក browser ទៅ `http://localhost:3000` ចូលដោយ៖
- អ៊ីមែល៖ `admin@modernfarmer.kh`
- ពាក្យសម្ងាត់៖ អ្វីដែលអ្នកដាក់ក្នុង `SEED_ADMIN_PASSWORD` (លំនាំដើម `ChangeMe123!`)

> **ប្តូរពាក្យសម្ងាត់នេះភ្លាមៗ** មុនប្រើពិត។

## ក.៤ ឱ្យទូរស័ព្ទក្នុងផ្ទះ/ការិយាល័យចូលបាន

រកលេខ IP របស់កុំព្យូទ័រ៖
- Windows: `ipconfig` → មើល IPv4 Address
- macOS/Linux: `ip addr` ឬ `ifconfig`

រួចលើទូរស័ព្ទ (ភ្ជាប់ WiFi ដដែល) បើក `http://192.168.x.x:3000`

> នេះសម្រាប់សាកល្បងក្នុងបណ្តាញផ្ទះប៉ុណ្ណោះ។ សម្រាប់ប្រើពិតពីខាងក្រៅ សូមមើលផ្នែក **ខ**។

---

# ខ. ដំឡើងលើ VPS សម្រាប់ប្រើពិត

## ខ.១ អ្វីដែលត្រូវទិញជាមុន

| របស់ | ការណែនាំ |
|---|---|
| **VPS** | Ubuntu 24.04, RAM ២GB, ថាសរឹង ២០GB គ្រប់គ្រាន់ណាស់ |
| **ដូមេន** | ឧ. `app.modernfarmer.com` ឬ subdomain នៃដូមេនដែលមានស្រាប់ |

ចង្អុលដូមេនទៅ IP របស់ VPS មុនសិន (បង្កើត DNS A record) ព្រោះការដំឡើង HTTPS ត្រូវការវា។

## ខ.២ ភ្ជាប់ទៅ VPS

```bash
ssh root@IP_របស់_VPS
```

## ខ.៣ បង្កើតអ្នកប្រើសម្រាប់កម្មវិធី (កុំរត់ជា root)

```bash
adduser --disabled-password --gecos "" farmer
usermod -aG sudo farmer
```

## ខ.៤ ដំឡើងកម្មវិធីត្រូវការ

```bash
apt update && apt upgrade -y

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# PostgreSQL និង Nginx
apt install -y postgresql postgresql-contrib nginx

# ពិនិត្យ
node -v && psql --version
```

## ខ.៥ បង្កើត database និងអ្នកប្រើ database

```bash
sudo -u postgres psql
```

ក្នុង psql វាយ (ប្តូរពាក្យសម្ងាត់ជាអ្វីដែលអ្នកជ្រើស)៖
```sql
CREATE USER farmer_app WITH PASSWORD 'ពាក្យសម្ងាត់ខ្លាំងមួយ';
CREATE DATABASE modern_farmer OWNER farmer_app;
\q
```

## ខ.៦ យកកូដឡើង VPS

**បើប្រើ Git៖**
```bash
su - farmer
git clone <URL_របស់_repo> ~/modern-farmer
cd ~/modern-farmer
```

**បើមិនប្រើ Git** — ពីកុំព្យូទ័រខ្លួនឯង៖
```bash
scp -r ./modern-farmer farmer@IP_របស់_VPS:~/
```

## ខ.៧ រៀបចំកម្មវិធី

```bash
cd ~/modern-farmer
npm install --omit=dev
cp .env.example .env
nano .env
```

កែឱ្យបាន៖
```
DATABASE_URL=postgres://farmer_app:ពាក្យសម្ងាត់@localhost:5432/modern_farmer
JWT_SECRET=<លទ្ធផលពី openssl rand -base64 48>
NODE_ENV=production
PORT=3000
SEED_ADMIN_EMAIL=admin@yourdomain.com
SEED_ADMIN_PASSWORD=<ពាក្យសម្ងាត់ដំបូងខ្លាំងមួយ>
```

បង្កើត JWT_SECRET៖
```bash
openssl rand -base64 48
```

រួចរត់៖
```bash
npm run migrate
npm run seed

cd web && npm install && npm run build && cd ..
```

សាកល្បង៖
```bash
npm start
# គួរឃើញ ✅ ... ដំណើរការនៅ http://localhost:3000
# ចុច Ctrl+C ដើម្បីបញ្ឈប់
```

## ខ.៨ ឱ្យកម្មវិធីរត់ជាប់ (systemd)

ចេញពី user `farmer` ត្រឡប់ជា root (`exit`) រួច៖

```bash
nano /etc/systemd/system/modern-farmer.service
```

ដាក់ខ្លឹមសារ៖
```ini
[Unit]
Description=Modern Farmer business system
After=network.target postgresql.service

[Service]
Type=simple
User=farmer
WorkingDirectory=/home/farmer/modern-farmer
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

បើកដំណើរការ៖
```bash
systemctl daemon-reload
systemctl enable --now modern-farmer
systemctl status modern-farmer      # គួរឃើញ active (running)
```

មើល log ពេលមានបញ្ហា៖
```bash
journalctl -u modern-farmer -f
```

## ខ.៩ Nginx នៅខាងមុខ

```bash
nano /etc/nginx/sites-available/modern-farmer
```

```nginx
server {
    listen 80;
    server_name app.modernfarmer.com;   # ប្តូរជាដូមេនរបស់អ្នក

    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/modern-farmer /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

ឥឡូវ `http://app.modernfarmer.com` គួរបើកបានហើយ។

## ខ.១០ បើក HTTPS (ចាំបាច់)

កម្មវិធីផ្ញើ token ចូល-ចេញ។ បើគ្មាន HTTPS អ្នកដទៃលើបណ្តាញអាចលួចមើលបាន។

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d app.modernfarmer.com
```

Certbot នឹងកែ Nginx ដោយស្វ័យប្រវត្តិ និងបន្តសុពលភាពវិញ្ញាបនបត្រឯងរាល់ ៣ ខែ។

បន្ទាប់មកបន្ថែមក្នុង `.env`៖
```
CORS_ORIGIN=https://app.modernfarmer.com
```

## ខ.១១ បិទច្រកមិនប្រើ

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Port 3000 មិនបើកចេញក្រៅទេ — មានតែ Nginx ទេដែលចូលបាន។ Port 5432 (PostgreSQL) ក៏ដូចគ្នា។

## ខ.១២ Backup ស្វ័យប្រវត្តិប្រចាំថ្ងៃ

នេះជាជំហានសំខាន់បំផុតមួយ។ ទិន្នន័យអាជីវកម្មបាត់ គឺជាបញ្ហាធ្ងន់ធ្ងរជាងម៉ាស៊ីនដាច់។

```bash
mkdir -p /var/backups/modern-farmer
nano /usr/local/bin/mf-backup.sh
```

```bash
#!/bin/bash
set -e
DIR=/var/backups/modern-farmer
DATE=$(date +%F)
sudo -u postgres pg_dump modern_farmer | gzip > "$DIR/mf-$DATE.sql.gz"
# រក្សាទុក ៣០ ថ្ងៃចុងក្រោយ
find "$DIR" -name 'mf-*.sql.gz' -mtime +30 -delete
```

```bash
chmod +x /usr/local/bin/mf-backup.sh
crontab -e
```

បន្ថែមបន្ទាត់ (រត់ម៉ោង ២ យប់រាល់ថ្ងៃ)៖
```
0 2 * * * /usr/local/bin/mf-backup.sh
```

សាកល្បងភ្លាម៖
```bash
/usr/local/bin/mf-backup.sh && ls -lh /var/backups/modern-farmer
```

> **ចម្លងទៅកន្លែងផ្សេងផង។** Backup នៅលើម៉ាស៊ីនតែមួយ មិនជួយអ្វីទេបើម៉ាស៊ីននោះខូច។ ទាញមកកុំព្យូទ័រការិយាល័យប្រចាំសប្តាហ៍៖
> ```bash
> scp farmer@IP:/var/backups/modern-farmer/mf-*.sql.gz ./
> ```

**ស្តារទិន្នន័យវិញ** (ពេលចាំបាច់)៖
```bash
gunzip -c mf-2026-09-05.sql.gz | sudo -u postgres psql modern_farmer
```

---

# ង. Supabase + Vercel (មិនត្រូវការ VPS)

ជម្រើសនេះស័ក្តិសមបំផុតបើអ្នកមិនចង់ចេះគ្រប់គ្រង server ដោយខ្លួនឯង។ គ្មាន command line ស្មុគស្មាញ គ្មាន Nginx គ្មាន systemd — ចុចលើគេហទំព័រតែប៉ុណ្ណោះ។

**របៀបដំណើរការ**: Supabase ផ្តល់ database (PostgreSQL); Vercel ផ្តល់កន្លែងបង្ហោះកម្មវិធី (ទាំងផ្ទាំង និង API)។ ២ សេវានេះឥតគិតថ្លៃគ្រប់គ្រាន់សម្រាប់អាជីវកម្មខ្នាតតូច-មធ្យម។

> **ចំណាំពីខ្ញុំ:** ខ្ញុំបានកែកូដឱ្យត្រូវនឹងរបៀបធ្វើការរបស់ Vercel រួចហើយ (serverless function) ហើយបានសាកល្បងផ្នែកដែលអាចសាកល្បងបានពីទីនេះ (កូដដំណើរការត្រឹមត្រូវទាំងជា server ធម្មតា និងជា serverless function)។ ប៉ុន្តែខ្ញុំមិនអាចភ្ជាប់ទៅ Supabase ឬ Vercel ផ្ទាល់ដើម្បីសាកល្បងការ publish ជាក់ស្តែងបានទេ (បណ្តាញរបស់ខ្ញុំមិនអនុញ្ញាតឱ្យទៅដល់គេហទំព័រទាំងនោះ)។ ដូច្នេះដំណើរការខាងក្រោមផ្អែកលើឯកសារជាផ្លូវការរបស់ Supabase/Vercel — បើជួបអេក្រង់ណាមួយមិនដូចដែលពិពណ៌នា ប្រាប់ខ្ញុំបាន ខ្ញុំជួយស្វែងរកដំណោះស្រាយ។

## ង.១ បង្កើត Supabase project

1. ចូល **[supabase.com](https://supabase.com)** → ចុច **Start your project** → ចូលដោយគណនី GitHub
2. ចុច **New project**
3. បំពេញ៖
   - **Name**: `modern-farmer`
   - **Database Password**: ចុច generate ឬវាយផ្ទាល់ខ្លួន — **កត់ទុកកន្លែងសុវត្ថិភាព** (ត្រូវការក្រោយ)
   - **Region**: ជ្រើសតំបន់ជិតកម្ពុជាបំផុត (ឧ. Singapore)
4. ចុច **Create new project** — រង់ចាំប្រហែល ២ នាទី ខណៈ Supabase រៀបចំ database

## ង.២ បង្កើតតារាងទាំងអស់ (SQL Editor — គ្មាន command line)

នៅផ្ទាំង Supabase៖

1. ចុច **SQL Editor** នៅរបារខាងឆ្វេង → **New query**
2. បើកឯកសារ `db/schema.sql` ក្នុងកម្មវិធីណាមួយលើកុំព្យូទ័រអ្នក (Notepad ក៏បាន) → ចម្លងខ្លឹមសារទាំងអស់ → ថតចូល SQL Editor → ចុច **Run**
3. ធ្វើដដែលសម្រាប់ `db/migration_002_sales_finance.sql` (New query → ចម្លង → Run)
4. ធ្វើដដែលសម្រាប់ `db/migration_003_offline.sql` រួច `db/migration_004_users.sql`
5. ចុងក្រោយ ធ្វើដដែលសម្រាប់ `db/seed.sql` — នេះបញ្ចូលទិន្នន័យដំបូង (ឯកតា ផលិតផល វេចខ្ចប់) និងគណនី admin ជាមួយ៖
   - អ៊ីមែល: `admin@modernfarmer.kh`
   - ពាក្យសម្ងាត់: `ChangeMe123!`

រត់តាមលំដាប់ខាងលើ (schema → 002 → 003 → 004 → seed) ព្រោះនីមួយៗពឹងផ្អែកលើមុន។ បើឃើញ "Success. No rows returned" គឺត្រឹមត្រូវហើយ។

> ខ្ញុំបានសាកល្បងឯកសារ `seed.sql` នេះលើ PostgreSQL ពិត ហើយចូលប្រព័ន្ធបានជោគជ័យដោយប្រើពាក្យសម្ងាត់ខាងលើ។

## ង.៣ យកលេខតភ្ជាប់ Database

1. ចុច **Project Settings** (រូបកង់ខាងឆ្វេងក្រោម) → **Database**
2. រំកិលចុះមកផ្នែក **Connection string** → ជ្រើសផ្ទាំង **Transaction pooler** (សំខាន់! មិនមែន Session ឬ Direct)

   > ហេតុអ្វីត្រូវ Transaction pooler? Vercel រត់កូដជា "serverless function" ដែលបើកការតភ្ជាប់ database ថ្មីញឹកញាប់។ Transaction pooler (port `6543`) ត្រូវបានរចនាមកសម្រាប់ករណីនេះជាក់ស្តែង។ Direct connection (port `5432`) នឹងអស់ដែនកំណត់ការតភ្ជាប់លឿនពេលមានអ្នកប្រើច្រើននាក់ព្រមគ្នា។

3. ចម្លងខ្សែអក្សរដែលមានទម្រង់៖
   ```
   postgres://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-xxxxx.pooler.supabase.com:6543/postgres
   ```
4. ជំនួស `[YOUR-PASSWORD]` ដោយពាក្យសម្ងាត់ដែលអ្នកកត់ទុកនៅជំហាន ង.១ — **រក្សាខ្សែអក្សរនេះទុក** ត្រូវការក្នុងជំហានបន្ទាប់

## ង.៤ ដាក់កូដឡើង GitHub

Vercel ដាក់ដំណើរការដោយទាញកូដពី GitHub ស្វ័យប្រវត្តិ។

1. ចូល **[github.com](https://github.com)** → ចុច **+** ខាងស្តាំលើ → **New repository**
2. ដាក់ឈ្មោះ `modern-farmer` → ជ្រើស **Private** (ព័ត៌មានអាជីវកម្មមិនគួរបើកសាធារណៈ) → **Create repository**
3. លើកទឹកចិត្តឱ្យប្រើ GitHub Desktop (`desktop.github.com`) បើមិនធ្លាប់ប្រើ `git` តាម command line៖
   - ដំឡើង GitHub Desktop → ចូលគណនី → **Add** → **Add existing repository** → ជ្រើសថតកម្មវិធីនៅលើកុំព្យូទ័រអ្នក
   - វានឹងសួរផ្សារភ្ជាប់ទៅ repository លើ GitHub ដែលបង្កើតខាងលើ → ចុច **Publish repository**

ឬបើស្គាល់ command line៖
```bash
cd modern-farmer
git init
git add .
git commit -m "ចាប់ផ្តើម"
git branch -M main
git remote add origin https://github.com/<username>/modern-farmer.git
git push -u origin main
```

> **សំខាន់**: ត្រូវប្រាកដថា `.env` មិនត្រូវបានផ្ញើឡើង GitHub ទេ (ឯកសារ `.gitignore` រួចរាល់ការពារហើយ)។ Environment variables ដាក់ដោយផ្ទាល់ក្នុង Vercel dashboard នៅជំហានបន្ទាប់វិញ។

## ង.៥ ភ្ជាប់ទៅ Vercel

1. ចូល **[vercel.com](https://vercel.com)** → ចូលដោយគណនី GitHub ដដែល
2. ចុច **Add New...** → **Project**
3. ជ្រើស repository `modern-farmer` ដែលទើបបង្កើត → ចុច **Import**
4. នៅផ្ទាំង **Configure Project**:
   - **Framework Preset**: ទុក **Other** (ព្រោះឯកសារ `vercel.json` កំណត់ការ build ស្រាប់ហើយ)
   - **Root Directory**: ទុកជា `.` (root)
5. ចុច **Environment Variables** ដើម្បីបើកទម្រង់ → បញ្ចូលម្តងមួយៗ:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | ខ្សែអក្សរពី ង.៣ (Transaction pooler) |
   | `DB_SSL` | `true` |
   | `JWT_SECRET` | អក្សរចៃដន្យវែង — បង្កើតដោយចូល [randomkeygen.com](https://randomkeygen.com) យក "CodeIgniter Encryption Keys" ណាមួយ ឬវែងជាង |
   | `SEED_ADMIN_EMAIL` | `admin@modernfarmer.kh` |
   | `SEED_ADMIN_PASSWORD` | `ChangeMe123!` |
   | `CRON_SECRET` | អក្សរចៃដន្យមួយទៀត (សម្រាប់ការសម្អាតទិន្នន័យប្រចាំថ្ងៃ — មិនចាំបាច់ចងចាំ) |

6. ចុច **Deploy**

រង់ចាំប្រហែល ១-២ នាទី។ Vercel នឹង build ទាំងផ្ទាំង (React) និង API (Express) ព្រមគ្នា។

> **បើឃើញកំហុស** `The pattern ... doesn't match any Serverless Functions inside the api directory` — មានន័យថាឯកសារ `api/index.js` មិនបានឡើងដល់ GitHub។ ចូល repository លើ GitHub ចុចចូលថត `api/` ដើម្បីពិនិត្យ។ បើទទេ សូមផ្ទុកឯកសារនោះឡើងដោយ **Add file → Upload files**។

## ង.៦ សាកល្បង

ពេល build ជោគជ័យ Vercel បង្ហាញតំណភ្ជាប់ដូចជា `modern-farmer-xxxx.vercel.app`។ ចុចលើវា រួច៖

1. ចូលដោយ `admin@modernfarmer.kh` / `ChangeMe123!`
2. ចូល **ការកំណត់** → បង្កើតវត្ថុធាតុដើមសាកល្បងមួយ ដើម្បីប្រាកដថា database ភ្ជាប់បានត្រឹមត្រូវ
3. **ប្តូរពាក្យសម្ងាត់ admin ភ្លាមៗ**

បើមានបញ្ហា ចូល Vercel dashboard → ចុចលើ deployment → **Functions** → មើល log នៃ `api/index`។

## ង.៧ ភ្ជាប់ដូមេនផ្ទាល់ខ្លួន (ស្រេចចិត្ត)

1. ក្នុង Vercel project → **Settings** → **Domains**
2. វាយដូមេនរបស់អ្នក (ឧ. `app.modernfarmer.com`) → ចុច **Add**
3. Vercel នឹងបង្ហាញ DNS record ត្រូវបន្ថែម (ជាទូទៅជា CNAME) → ចម្លងទៅដាក់ក្នុងផ្ទាំងគ្រប់គ្រងដូមេនរបស់អ្នក (ឧ. GoDaddy, Namecheap)
4. រង់ចាំ DNS ផ្សព្វផ្សាយ (ជាទូទៅ ១០ នាទី ដល់ ២៤ ម៉ោង) — HTTPS ចេញស្វ័យប្រវត្តិ

## ង.៨ ធ្វើបច្ចុប្បន្នភាពក្រោយពេលនេះ

លុះត្រាតែធ្វើ **ង.៤** ម្តងទៀត៖ រាល់ការផ្លាស់ប្តូរកូដ ត្រូវ push ឡើង GitHub (តាម GitHub Desktop ចុច **Commit** → **Push**, ឬ `git add . && git commit -m "..." && git push`)។ Vercel ស្គាល់ ហើយ deploy ថ្មីស្វ័យប្រវត្តិក្នុងរយៈពេលប្រហែល ១ នាទី — គ្មានជំហានផ្សេងទៀត។

**បើមាន migration SQL ថ្មី** (ខ្ញុំបន្ថែមមុខងារបន្ថែម): ត្រូវចម្លងទៅ Supabase SQL Editor ដោយដៃដដែល (ដូច ង.២) — Vercel មិនរត់ SQL ឱ្យស្វ័យប្រវត្តិទេ។

## ង.៩ Backup លើ Supabase

Supabase ធ្វើ backup ស្វ័យប្រវត្តិឱ្យរួចហើយ (ថ្ងៃចុងក្រោយ សម្រាប់ផែនការឥតគិតថ្លៃ; យូរជាងនេះ សម្រាប់ផែនការបង់ថ្លៃ)។ មើលបាននៅ **Project Settings → Database → Backups**។ ទោះជាយ៉ាងណា ណែនាំទាញមកខ្លួនឯងម្តងម្កាលដែរ (Database → Backups → ចុច download នៅ backup ណាមួយ)។

## ង.១០ ដែនកំណត់នៃជម្រើសនេះ (ត្រូវដឹងទុក)

| ចំណុច | ការពន្យល់ |
|---|---|
| ការចាប់ផ្តើមយឺតដំបូង (cold start) | បន្ទាប់ពីមិនប្រើប្រាស់ប្រហែល ១ នាទី សំណើបន្ទាប់អាចយឺតជា ១-២ វិនាទីបន្ថែម ខណៈ function ចាប់ផ្តើមឡើងវិញ — មិនប៉ះពាល់ដល់ការធ្វើការធម្មតា |
| ការកំណត់ការសាកល្បងចូល (rate limit) | រក្សាទុកក្នុងសតិ instance — ការការពារនៅតែធ្វើការ ប៉ុន្តែអាចត្រូវកំណត់ឡើងវិញញឹកញាប់ជាង VPS បន្តិច (មិនប៉ះពាល់សុវត្ថិភាពសំខាន់) |
| ថ្លៃដើម | ឥតគិតថ្លៃគ្រប់គ្រាន់សម្រាប់អាជីវកម្មខ្នាតតូច។ បើប្រើច្រើនហួស (traffic ច្រើន, database ធំ) នឹងចាំបាច់ upgrade ទៅផែនការបង់ថ្លៃ (មើលតម្លៃលើ vercel.com/pricing និង supabase.com/pricing) |
| គ្រប់គ្រងខ្លួនឯង | តិចជាង VPS — Vercel/Supabase គ្រប់គ្រង server ឱ្យ ដែលល្អសម្រាប់មិនចង់រវល់ ប៉ុន្តែមានន័យថាអាស្រ័យលើគេ |

---

# គ. រៀបចំសម្រាប់ក្រុមការងារ

## គ.១ បង្កើតគណនីបុគ្គលិក

ចូលជា admin → **ច្រើនទៀត** → បើមិនទាន់មានផ្ទាំងគ្រប់គ្រងអ្នកប្រើ អាចបង្កើតតាម API៖

```bash
curl -X POST https://app.modernfarmer.com/api/auth/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_របស់_admin>" \
  -d '{"full_name":"សុខ ចាន់ថា","email":"sales@modernfarmer.kh","password":"...","role":"sales"}'
```

តួនាទីមាន ៤៖

| តួនាទី | ឃើញអ្វី |
|---|---|
| `admin` | គ្រប់យ៉ាង រួមទាំងលុបចោលវិក្កយបត្រ និងហិរញ្ញវត្ថុ |
| `stock` | ស្តុក · ផលិតកម្ម · ការទិញ |
| `sales` | ការលក់ · អតិថិជន · មើលស្តុក |
| `accountant` | ហិរញ្ញវត្ថុ · ចំណាយ · លុយជំពាក់ |

## គ.២ ដំឡើងលើទូរស័ព្ទបុគ្គលិក

កម្មវិធីនេះជា PWA — មិនចាំបាច់ចូល Play Store ទេ។

**Android (Chrome)**
1. បើក `https://app.modernfarmer.com`
2. ចុចប៊ូតុង ⋮ ខាងស្តាំលើ
3. ជ្រើស **Add to Home screen** (ដាក់ចូលអេក្រង់ដើម)

**iPhone (Safari)**
1. បើកតំណដដែល
2. ចុចប៊ូតុងចែករំលែក (ប្រអប់មានព្រួញឡើងលើ)
3. ជ្រើស **Add to Home Screen**

បន្ទាប់មករូបតំណាងលេចលើអេក្រង់ដើម ហើយបើកដូច app ធម្មតា។

## គ.៣ ការកត់ត្រាពេលអ៊ីនធឺណិតដាច់

នៅរោងចក្រ បណ្តាញអាចដាច់។ កម្មវិធីរៀបចំសម្រាប់រឿងនេះ៖

- **អានបាន** — ទិន្នន័យដែលធ្លាប់មើលរួច នៅតែបង្ហាញ
- **កត់ត្រាបាន** — ការទិញ ការបញ្ចូលវត្ថុធាតុដើម ការវេចខ្ចប់ និងការកែតម្រូវស្តុក ចូល «ជួររង់ចាំ»
- **ផ្ញើឯង** — ពេលបណ្តាញត្រឡប់មក កម្មវិធីផ្ញើដោយស្វ័យប្រវត្តិតាមលំដាប់ដើម

របារពណ៌លឿងខាងលើបង្ហាញចំនួនសំណើរង់ចាំ។ ចុចលើវាដើម្បីមើលបញ្ជី ឬចុច «ផ្ញើឥឡូវ»។

**បើសំណើណាមួយបរាជ័យ** (ឧ. ស្តុកមិនគ្រប់ ព្រោះមានគេប្រើអស់មុន) របារប្រែជាពណ៌ក្រហម ហើយបង្ហាញមូលហេតុ។ សំណើនោះ **មិនត្រូវបានកត់ត្រាទេ** — ត្រូវពិនិត្យ រួចធ្វើឡើងវិញដោយដៃ។

> **ការលក់មិនចូលជួររង់ចាំទេ** — ដោយចេតនា។ ការលក់ត្រូវដឹងភ្លាមថាស្តុកគ្រប់ ឬអត់ មុនប្រាប់អតិថិជន។ ដូច្នេះការលក់ត្រូវការបណ្តាញ។

## គ.៤ លំដាប់ការងារប្រចាំថ្ងៃ

1. **ទិញវត្ថុធាតុដើមចូល** → ការទិញ → បញ្ជាទិញថ្មី → បញ្ជាក់ចូលស្តុក
2. **ផលិត** → Batch ថ្មី → បញ្ចូលវត្ថុធាតុដើម → បញ្ចប់ Batch (វាយទិន្នផលពិត)
3. **វេចខ្ចប់** → បើក batch → វេចខ្ចប់ → ក្លាយជាស្តុកលក់បាន
4. **លក់** → លក់ថ្មី → បញ្ជាក់ (ដកស្តុក ផ្តល់ពិន្ទុ) → កត់ត្រាការទូទាត់
5. **ចុងខែ** → ហិរញ្ញវត្ថុ → ប្រកាសរំលស់ → មើលចំណេញ-ខាត

---

# ឃ. ការថែទាំ

> ផ្នែក ឃ.១–ឃ.៤ ខាងក្រោមសម្រាប់ជម្រើស **ខ. VPS**។ បើប្រើ **ង. Supabase + Vercel** សូមរំលងទៅ **ឃ.៦** ខាងក្រោម។

## ឃ.១ ធ្វើបច្ចុប្បន្នភាពកូដ

```bash
su - farmer
cd ~/modern-farmer
git pull                      # ឬ scp ឯកសារថ្មីឡើង
npm install --omit=dev
npm run migrate               # រត់តែពេលមាន migration ថ្មី — សុវត្ថិភាពរត់ម្តងទៀត
cd web && npm install && npm run build && cd ..
exit
systemctl restart modern-farmer
```

## ឃ.២ ពិនិត្យសុខភាពប្រព័ន្ធ

```bash
curl -s https://app.modernfarmer.com/api/health
# គួរបាន {"ok":true,"db":"connected",...}
```

## ឃ.៣ បញ្ហាទូទៅ (VPS)

| រោគសញ្ញា | មូលហេតុទំនង | ដំណោះស្រាយ |
|---|---|---|
| `502 Bad Gateway` | កម្មវិធីមិនរត់ | `systemctl status modern-farmer` រួច `journalctl -u modern-farmer -n 50` |
| `{"ok":false,"db":"disconnected"}` | PostgreSQL បិទ ឬ `DATABASE_URL` ខុស | `systemctl status postgresql` · ពិនិត្យ `.env` |
| ចូលមិនបាន «អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ» | គណនីខុស ឬ `is_active=false` | បង្កើត admin ថ្មីដោយ `npm run seed` (មិនលុបទិន្នន័យចាស់ទេ) |
| ទំព័រសទាំងស្រុង | `web/dist` មិនទាន់ build | `cd web && npm run build` រួច `systemctl restart modern-farmer` |
| ជួររង់ចាំមិនផ្ញើ | បណ្តាញនៅដាច់ ឬ token ផុតកំណត់ | ចូលប្រព័ន្ធម្តងទៀត រួចចុច «ផ្ញើឥឡូវ» |
| លេខស្តុកមើលទៅចម្លែក | មានការកែតម្រូវដោយដៃ | ស្តុក → ចលនាស្តុក — មើលឃើញនរណាកែ អ្វី កាលណា |

## ឃ.៤ បញ្ជីត្រួតពិនិត្យសុវត្ថិភាព (VPS)

- [ ] `JWT_SECRET` ជាតម្លៃចៃដន្យវែង មិនមែនតម្លៃលំនាំដើម
- [ ] ប្តូរពាក្យសម្ងាត់ admin រួចហើយ
- [ ] HTTPS ដំណើរការ (មានរូបសោក្នុង browser)
- [ ] `ufw` បើក ហើយ port 3000/5432 មិនចេញក្រៅ
- [ ] Backup ប្រចាំថ្ងៃរត់ ហើយបានសាកស្តារវិញម្តងជាការសាកល្បង
- [ ] បុគ្គលិកម្នាក់មានគណនីម្នាក់ (កុំចែកគណនីរួម — បើចែក audit log គ្មានន័យ)
- [ ] `.env` មិនចូល Git

## ឃ.៦ បញ្ហាទូទៅ (Supabase + Vercel)

| រោគសញ្ញា | មូលហេតុទំនង | ដំណោះស្រាយ |
|---|---|---|
| Deploy បរាជ័យលើ Vercel | កំហុសក្នុង build | Vercel dashboard → ចុចលើ deployment ដែលបរាជ័យ → អាន **Build Logs** |
| `{"ok":false,"db":"disconnected"}` | `DATABASE_URL` ខុស ឬភ្ជាប់ port 5432 ជំនួស 6543 | ពិនិត្យប្រើ **Transaction pooler** (port 6543) ក្នុង Environment Variables |
| សំណើទី ១ យឺត បន្ទាប់ពីមិនប្រើយូរ | Cold start ធម្មតារបស់ serverless | រង់ចាំ ១-២ វិនាទី សំណើបន្ទាប់លឿនធម្មតា |
| ការធ្វើបច្ចុប្បន្នភាពមិនចេញ | ភ្លេច push ទៅ GitHub | ពិនិត្យ GitHub Desktop មាន **Push** ត្រូវចុច ឬ Vercel dashboard មាន deployment ថ្មីទេ |
| Migration SQL ថ្មីមិនដំណើរការ | Vercel មិនរត់ SQL ស្វ័យប្រវត្តិ | ចម្លងទៅ Supabase SQL Editor ដោយដៃ (ដូច ង.២) |
| Cron មិនសម្អាតទិន្នន័យ | `CRON_SECRET` មិនបានកំណត់ | Vercel Project → Settings → Environment Variables → បន្ថែម `CRON_SECRET` |

## ឃ.៥ ការផ្លាស់ប្តូរពី Google Sheets

កុំប្តូរភ្លាមទាំងស្រុង។ ណែនាំ៖

1. **សប្តាហ៍ទី ១–២** — កត់ត្រាទាំង ២ កន្លែងស្របគ្នា (Sheets និងប្រព័ន្ធថ្មី)
2. ចុងសប្តាហ៍នីមួយៗ ប្រៀបធៀបលេខស្តុក និងចំណូល — បើខុសគ្នា ស្វែងរកមូលហេតុមុនបន្ត
3. **សប្តាហ៍ទី ៣** — បើលេខត្រូវគ្នា ឈប់កត់ក្នុង Sheets តែរក្សាទុកជាឯកសារយោង
4. បញ្ចូលទិន្នន័យចាស់ (អតិថិជន អ្នកផ្គត់ផ្គង់ ស្តុកបច្ចុប្បន្ន) តាមផ្ទាំង «ការកំណត់» និង «កែតម្រូវស្តុក»

ការធ្វើស្របគ្នាបន្តិចធុញ ប៉ុន្តែវាចាប់បញ្ហាមុនពេលទិន្នន័យខុសក្លាយជាទម្លាប់។
