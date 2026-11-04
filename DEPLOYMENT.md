# KACC Dashboard - Vercel + Supabase Deployment Guide

Panduan lengkap deploy KACC Dashboard ke Vercel dengan database Supabase.

## 📋 Prerequisites

- Akun [Vercel](https://vercel.com) (free tier cukup)
- Akun [Supabase](https://supabase.com) (free tier cukup - 500MB storage)
- Akun [GitHub](https://github.com) (untuk push code)
- Google Sheets tetap accessible dengan sharing "Anyone with link can view"

## 🚀 Step 1: Setup Supabase Database

1. **Buat project Supabase baru**
   - Login ke https://supabase.com
   - Klik **"New Project"**
   - Name: `kacc-dashboard`
   - Database Password: **simpan password ini** (akan dipakai nanti)
   - Region: pilih yang terdekat (Singapore untuk Indonesia)
   - Klik **"Create new project"**
   - Tunggu 2-3 menit sampai project ready

2. **Get connection string**
   - Di Supabase dashboard, buka **Project Settings** (gear icon kiri bawah)
   - Klik **Database**
   - Di section **"Connection string"**, pilih **"URI"** tab
   - Pilih **"Transaction"** mode (pooler - recommended untuk Vercel)
   - Copy connection string - format-nya:
     ```
     postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
   - **Ganti `[YOUR-PASSWORD]`** dengan password yang Anda set di step 1

3. **Catat info ini** (akan dipakai di Step 3):
   - `DATABASE_URL` = connection string di atas (dengan password sudah diisi)

## 📦 Step 2: Push Code ke GitHub

1. **Buat repository baru di GitHub**
   - Login ke https://github.com
   - Klik **"+"** → **"New repository"**
   - Name: `kacc-dashboard`
   - Set **Private** (recommended)
   - **Jangan** centang "Add README", "Add .gitignore", atau "license" (sudah ada di project)
   - Klik **"Create repository"**

2. **Push code dari local ke GitHub**
   ```bash
   cd /home/z/my-project
   
   # Init git repo (kalau belum)
   git init
   git add .
   git commit -m "Initial commit - KACC Dashboard"
   
   # Add remote (ganti URL dengan repo Anda)
   git remote add origin https://github.com/[username]/kacc-dashboard.git
   git branch -M main
   git push -u origin main
   ```

## 🔧 Step 3: Deploy ke Vercel

1. **Import project ke Vercel**
   - Login ke https://vercel.com
   - Klik **"Add New"** → **"Project"**
   - Import repository `kacc-dashboard` dari GitHub
   - Vercel akan auto-detect sebagai Next.js project

2. **Configure Environment Variables** (PENTING!)
   - Di halaman import, scroll ke **"Environment Variables"**
   - Tambahkan variable berikut:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` | Production, Preview, Development |
   | `ADMIN_PIN` | `kacc2026` (atau PIN custom Anda) | Production, Preview, Development |
   | `ZAI_API_KEY` | *(dari Z.ai - opsional, untuk AI Insight)* | Production, Preview, Development |

   - **PENTING**: Ganti `[password]` di DATABASE_URL dengan password Supabase Anda yang sebenarnya

3. **Deploy**
   - Klik **"Deploy"**
   - Tunggu 2-3 menit sampai build selesai
   - Vercel akan kasih URL seperti `https://kacc-dashboard-[hash].vercel.app`

## 🗄️ Step 4: Setup Database Schema

Setelah deploy sukses, Anda perlu setup database schema di Supabase.

### Option A: Via Vercel CLI (recommended)

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login & link project:
   ```bash
   cd /home/z/my-project
   vercel login
   vercel link  # pilih project kacc-dashboard Anda
   ```

3. Run Prisma db push di Vercel environment:
   ```bash
   # Ini akan jalan dengan DATABASE_URL dari Vercel env vars
   vercel env pull .env.vercel
   bun run db:push
   ```

4. Seed initial data:
   ```bash
   bun run db:seed
   ```

### Option B: Via local dengan env var manual

1. Set DATABASE_URL di local `.env`:
   ```bash
   # Edit .env, ganti jadi:
   DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

2. Run migration & seed:
   ```bash
   bun run db:push
   bun run db:seed
   ```

## ✅ Step 5: Verify Deployment

1. **Buka URL Vercel** Anda (mis. `https://kacc-dashboard.vercel.app`)

2. **Test health check**:
   - Buka `https://[your-url].vercel.app/api/health`
   - Harusnya muncul JSON dengan `"status": "healthy"`
   - Check `googleSheetsFetch.ok` = `true` (artinya Vercel bisa fetch Google Sheets)

3. **Test dashboard**:
   - Buka `https://[your-url].vercel.app/`
   - Dashboard harusnya load dengan data Oktober 2026
   - Coba klik sheet dropdown → harusnya ada Oktober + September
   - Coba tombol "Generate Insight" → AI harusnya jalan

## 🔧 Step 6: Setup Custom Domain (Optional)

1. Di Vercel dashboard → project Anda → **Settings** → **Domains**
2. Add domain Anda (mis. `kacc.yourdomain.com`)
3. Setup DNS sesuai instruksi Vercel
4. Tunggu DNS propagate (5-30 menit)

## 🚨 Troubleshooting

### Error: "Database connection failed"
- Cek `DATABASE_URL` di Vercel env vars - pastikan password benar
- Pastikan pakai **Transaction mode** connection string (port 6543, bukan 5432)
- Pastikan ada `?pgbouncer=true&connection_limit=1` di akhir URL

### Error: "Sheet fetch gagal"
- Buka `/api/health` - cek `googleSheetsFetch.ok`
- Kalau false: pastikan Google Sheets sharing = "Anyone with link can view"
- Kalau timeout: Vercel Hobby plan punya limit 10s untuk non-pro functions. Upgrade ke Pro untuk 60s.

### Error: "AI Insight gagal"
- Pastikan `ZAI_API_KEY` sudah set di Vercel env vars
- Cek Vercel function logs: Dashboard → Functions → pilih endpoint → Logs

### Error: "Pin admin salah"
- Default PIN: `kacc2026`
- Bisa diubah via env var `ADMIN_PIN` di Vercel

### Dashboard loading terus
- Buka Developer Tools (F12) → Console → cek error
- Buka `/api/ping` - harusnya `{"ok":true}`
- Buka `/api/health` - lihat status tiap check

## 📊 Free Tier Limits

### Vercel Hobby (Free)
- 100GB bandwidth/bulan
- 1000 build hours/bulan
- Function execution: 10s timeout (Hobby) / 60s (Pro)
- **Cukup untuk KACC dashboard dengan traffic kecil-menengah**

### Supabase Free
- 500MB database storage
- 1GB file storage
- 50,000 monthly active users (auth)
- **Cukup untuk KACC dashboard (data sheet sources cuma beberapa KB)**

## 🔄 Update Deployment

Setiap kali Anda push ke branch `main` di GitHub:
1. Vercel auto-deploy (Preview + Production)
2. Build jalan otomatis (include `prisma generate`)
3. Production URL update dalam 1-2 menit

**Note**: Schema changes (Prisma) butuh manual `db:push` via CLI.

## 🆘 Bantuan

Kalau ada masalah:
1. Cek `/api/health` di URL production
2. Cek Vercel function logs
3. Cek Supabase logs (Database → Logs)
4. Copy error message + health check JSON untuk di-share
